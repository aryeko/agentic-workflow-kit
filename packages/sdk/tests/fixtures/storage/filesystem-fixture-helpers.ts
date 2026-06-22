import { afterEach, describe, expect, it } from 'vitest';

import type {
  AppendReceipt,
  ArtifactInput,
  ArtifactRef,
  EventLogLeaseBinding,
  FilesystemStorage,
  StorageError,
} from '../../../../src/index.js';

export const textEncoder = new TextEncoder();
export const textDecoder = new TextDecoder();

export const encodeBytes = (value: string): Uint8Array => textEncoder.encode(value);

export const digestBytes = (bytes: Uint8Array): string =>
  `digest:${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;

export const digestToken = (token: string): string => digestBytes(encodeBytes(token));

export const artifactInput = (
  content: string,
  overrides: Partial<Omit<ArtifactInput, 'content'>> = {},
): ArtifactInput => ({
  content: encodeBytes(content),
  mediaType: 'text/plain',
  retentionClass: 'evidence',
  classification: 'internal',
  producer: 'storage-conformance',
  ...overrides,
});

export const eventLogLeaseBinding = (overrides: Partial<EventLogLeaseBinding> = {}): EventLogLeaseBinding => ({
  name: 'run-writer:alpha',
  epoch: 1,
  token: 'lease-token-1',
  ...overrides,
});

export const assertStorageError = <T>(value: T | StorageError): StorageError => {
  expect(value).toHaveProperty('code');
  return value as StorageError;
};

export const assertAppendReceipt = (value: AppendReceipt | StorageError): AppendReceipt => {
  expect(value).toHaveProperty('firstSequence');
  return value as AppendReceipt;
};

export const readArtifactText = async (
  storage: FilesystemStorage,
  ref: ArtifactRef,
  mode: 'redacted' | 'raw' = 'redacted',
) => {
  const stream = storage.artifactStore.get(ref, mode);
  expect(stream).not.toHaveProperty('code');

  const reader = stream.bytes.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      break;
    }

    chunks.push(chunk.value);
    size += chunk.value.byteLength;
  }

  const bytes = new Uint8Array(size);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return textDecoder.decode(bytes);
};

export type FilesystemConformanceHarness = {
  readonly storage: FilesystemStorage;
  readonly reopen: () => FilesystemStorage;
  readonly cleanup?: () => void;
};

export const runFilesystemConformanceSuite = (
  label: string,
  createHarness: () => FilesystemConformanceHarness,
): void => {
  describe(label, () => {
    const cleanups: Array<() => void> = [];

    afterEach(() => {
      while (cleanups.length > 0) {
        cleanups.pop()?.();
      }
    });

    const useHarness = (): FilesystemConformanceHarness => {
      const harness = createHarness();
      if (harness.cleanup !== undefined) {
        cleanups.push(harness.cleanup);
      }
      return harness;
    };

    it('preserves append and replay equivalence across barrier durability and reopen', () => {
      const harness = useHarness();
      const lease = eventLogLeaseBinding();
      const handle = harness.storage.eventLogStore.openForAppend('run-log', lease);

      expect(handle).toEqual({
        logId: 'run-log',
        leaseName: 'run-writer:alpha',
        epoch: 1,
        token: 'lease-token-1',
      });

      expect(
        harness.storage.eventLogStore.append(handle, {
          expectedSequence: 1,
          durability: 'buffered',
          payloads: [encodeBytes('buffered-before-barrier')],
        }),
      ).toEqual({
        acknowledged: true,
        durability: 'buffered',
        expectedSequence: 1,
      });

      const durableReceipt = assertAppendReceipt(
        harness.storage.eventLogStore.append(handle, {
          expectedSequence: 2,
          durability: 'barrier',
          payloads: [encodeBytes('durable-after-buffer')],
        }),
      );

      expect(durableReceipt).toMatchObject({
        firstSequence: 1,
        lastSequence: 2,
        writerEpoch: 1,
        leaseName: 'run-writer:alpha',
        durability: 'barrier',
      });

      expect(harness.storage.eventLogStore.replay('run-log')).toEqual({
        health: 'ok',
        records: [
          {
            sequence: 1,
            writerEpoch: 1,
            leaseName: 'run-writer:alpha',
            payloadLength: 23,
            payloadDigest: expect.any(String),
            frameDigest: expect.any(String),
            byteRange: expect.any(Object),
            payload: encodeBytes('buffered-before-barrier'),
          },
          {
            sequence: 2,
            writerEpoch: 1,
            leaseName: 'run-writer:alpha',
            payloadLength: 20,
            payloadDigest: expect.any(String),
            frameDigest: expect.any(String),
            byteRange: expect.any(Object),
            payload: encodeBytes('durable-after-buffer'),
          },
        ],
      });

      const reopened = harness.reopen();
      expect(reopened.eventLogStore.replay('run-log')).toEqual(harness.storage.eventLogStore.replay('run-log'));
    });

    it('fences stale leases and advances epoch after release', () => {
      const harness = useHarness();
      const first = harness.storage.leaseStore.acquire('run-writer:alpha', 'holder-a', 60_000);

      expect(first).toMatchObject({
        name: 'run-writer:alpha',
        epoch: 1,
        token: expect.any(String),
      });

      expect(harness.storage.leaseStore.fence(first.name, first.epoch, first.token)).toBe(true);
      expect(harness.storage.leaseStore.acquire('run-writer:alpha', 'holder-b', 60_000)).toEqual({
        code: 'stale-writer-fenced',
        health: 'ok',
        message: 'Lease acquire was fenced because a live lease already exists.',
      });

      expect(harness.storage.leaseStore.release(first.name, first.epoch, first.token)).toBeUndefined();
      const second = harness.storage.leaseStore.acquire('run-writer:alpha', 'holder-c', 60_000);

      expect(second).toMatchObject({
        name: 'run-writer:alpha',
        epoch: 2,
        token: expect.any(String),
      });
      expect(harness.storage.leaseStore.fence(first.name, first.epoch, first.token)).toBe(false);
      expect(harness.storage.leaseStore.read('run-writer:missing')).toEqual({ health: 'ok' });
      expect(harness.storage.leaseStore.renew(first.name, first.epoch, 'stale-token', 60_000)).toEqual({
        code: 'stale-writer-fenced',
        health: 'ok',
        message: 'Lease renew was fenced because the supplied epoch or token is stale.',
      });
      expect(harness.storage.leaseStore.release(first.name, first.epoch, 'stale-token')).toEqual({
        code: 'stale-writer-fenced',
        health: 'ok',
        message: 'Lease release was fenced because the supplied epoch or token is stale.',
      });
    });

    it('rejects stale, empty, or non-current append handles before bytes are committed', () => {
      const harness = useHarness();
      let leaseIsCurrent = true;
      const initialHandle = harness.storage.eventLogStore.openForAppend(
        'stale-log',
        eventLogLeaseBinding({
          isCurrent: () => leaseIsCurrent,
        }),
      );
      harness.storage.eventLogStore.openForAppend(
        'stale-log',
        eventLogLeaseBinding({
          epoch: 2,
          token: 'lease-token-2',
        }),
      );

      expect(
        harness.storage.eventLogStore.append(initialHandle, {
          expectedSequence: 1,
          durability: 'durable',
          payloads: [encodeBytes('stale')],
        }),
      ).toEqual({
        code: 'stale-writer-fenced',
        health: 'ok',
        message: 'Append handle no longer matches the current lease binding for log stale-log.',
      });

      const currentHandle = harness.storage.eventLogStore.openForAppend(
        'current-log',
        eventLogLeaseBinding({
          isCurrent: () => leaseIsCurrent,
        }),
      );

      expect(
        harness.storage.eventLogStore.append(
          {
            ...currentHandle,
            token: '',
          },
          {
            expectedSequence: 1,
            durability: 'durable',
            payloads: [encodeBytes('missing-token')],
          },
        ),
      ).toEqual({
        code: 'stale-writer-fenced',
        health: 'ok',
        message: 'Append handle must include a lease name and token before bytes can be appended.',
      });

      expect(
        harness.storage.eventLogStore.append(currentHandle, {
          expectedSequence: 1,
          durability: 'durable',
          payloads: [],
        }),
      ).toEqual({
        code: 'stale-writer-fenced',
        health: 'ok',
        message: 'Append batch for log current-log must contain at least one payload.',
      });

      expect(
        harness.storage.eventLogStore.append(currentHandle, {
          expectedSequence: 4,
          durability: 'durable',
          payloads: [encodeBytes('wrong-sequence')],
        }),
      ).toEqual({
        code: 'stale-writer-fenced',
        health: 'ok',
        message: 'Expected sequence 4 does not match next append sequence 1 for log current-log.',
      });

      leaseIsCurrent = false;
      expect(
        harness.storage.eventLogStore.append(currentHandle, {
          expectedSequence: 1,
          durability: 'durable',
          payloads: [encodeBytes('not-current')],
        }),
      ).toEqual({
        code: 'stale-writer-fenced',
        health: 'ok',
        message: 'Append handle is no longer backed by a current lease for log current-log.',
      });
    });

    it('keeps artifacts immutable, redacts through tombstones, and exports verified selections', async () => {
      const harness = useHarness();
      const handle = harness.storage.eventLogStore.openForAppend('run-log', eventLogLeaseBinding());
      harness.storage.eventLogStore.append(handle, {
        expectedSequence: 1,
        durability: 'durable',
        payloads: [encodeBytes('log-export-one'), encodeBytes('log-export-two')],
      });

      const artifact = await harness.storage.artifactStore.put(artifactInput('sensitive transcript'));
      expect(artifact).toMatchObject({
        id: expect.stringMatching(/^artifact:sha256:/),
        redactionState: 'raw',
      });

      const repeat = await harness.storage.artifactStore.put(artifactInput('sensitive transcript'));
      expect(repeat).toEqual(artifact);

      const mismatchedMetadata = await harness.storage.artifactStore.put(
        artifactInput('sensitive transcript', { classification: 'restricted' }),
      );
      expect(mismatchedMetadata).toEqual({
        code: 'artifact-quarantined',
        health: 'ok',
        message: `Artifact ${artifact.id} failed metadata validation.`,
      });

      const replacement = harness.storage.artifactStore.redact(artifact, 'mask-all');
      expect(replacement).toMatchObject({
        id: expect.stringMatching(/^artifact:sha256:/),
        redactionState: 'redacted',
      });
      expect(replacement.id).not.toBe(artifact.id);

      expect(harness.storage.artifactStore.get(artifact, 'redacted')).toEqual({
        code: 'artifact-quarantined',
        health: 'ok',
        message: `Artifact ${artifact.id} is tombstoned and unavailable for redacted reads.`,
      });

      expect(await readArtifactText(harness.storage, replacement)).toBe('[REDACTED]');

      const manifest = harness.storage.artifactStore.export({
        artifactIds: [artifact.id, replacement.id],
        logRanges: [{ logId: 'run-log', fromSequence: 1, toSequence: 2 }],
      });

      expect(manifest).toMatchObject({
        redactionMode: 'redacted',
        logHealth: 'ok',
        artifacts: [
          {
            id: replacement.id,
            digest: replacement.digest,
            size: replacement.size,
            redactionState: 'redacted',
          },
          {
            id: artifact.id,
            digest: replacement.digest,
            size: replacement.size,
            redactionState: 'redacted',
          },
        ],
        logRanges: [
          {
            logId: 'run-log',
            fromSequence: 1,
            toSequence: 2,
            frameDigest: expect.any(String),
          },
        ],
      });
    });

    it('refuses export when a selected artifact can no longer be verified', async () => {
      const harness = useHarness();
      const artifact = await harness.storage.artifactStore.put(artifactInput('verify me'));
      expect(artifact).toMatchObject({
        id: expect.stringMatching(/^artifact:sha256:/),
      });

      harness.storage.debug.corruptArtifact(artifact.id, encodeBytes('corrupted-by-fixture'));

      expect(
        harness.storage.artifactStore.export({
          artifactIds: [artifact.id],
        }),
      ).toEqual({
        code: 'export-incomplete-forbidden',
        health: 'ok',
        message: `Artifact ${artifact.id} could not be verified for export.`,
      });
    });

    it('fails closed for missing artifacts, missing redaction hooks, and unverifiable log ranges', async () => {
      const harness = useHarness();
      const missingRef = {
        id: 'artifact:sha256:missing',
        digest: 'missing',
        size: 0,
        mediaType: 'text/plain',
        retentionClass: 'evidence',
        classification: 'internal',
        redactionState: 'raw',
      } as const;

      expect(harness.storage.artifactStore.resolve(missingRef.id)).toEqual({
        code: 'artifact-quarantined',
        health: 'ok',
        message: `Artifact ${missingRef.id} could not be resolved.`,
      });
      expect(harness.storage.artifactStore.get(missingRef, 'redacted')).toEqual({
        code: 'artifact-quarantined',
        health: 'ok',
        message: `Artifact ${missingRef.id} could not be resolved.`,
      });
      expect(harness.storage.artifactStore.redact(missingRef, 'missing-hook')).toEqual({
        code: 'artifact-quarantined',
        health: 'ok',
        message: `Artifact ${missingRef.id} could not be resolved.`,
      });
      expect(
        harness.storage.artifactStore.export({
          artifactIds: [missingRef.id],
        }),
      ).toEqual({
        code: 'export-incomplete-forbidden',
        health: 'ok',
        message: `Artifact ${missingRef.id} could not be verified for export.`,
      });

      const handle = harness.storage.eventLogStore.openForAppend('range-log', eventLogLeaseBinding());
      harness.storage.eventLogStore.append(handle, {
        expectedSequence: 1,
        durability: 'durable',
        payloads: [encodeBytes('only-one')],
      });

      expect(
        harness.storage.artifactStore.export({
          artifactIds: [],
          logRanges: [{ logId: 'range-log', fromSequence: 1, toSequence: 2 }],
        }),
      ).toEqual({
        code: 'export-incomplete-forbidden',
        health: 'ok',
        message: 'Log range range-log:1-2 could not be verified for export.',
      });
    });

    it('covers raw tombstone reads, hook validation, and scratch refusal while healthy', async () => {
      const harness = useHarness();
      const artifact = await harness.storage.artifactStore.put(artifactInput('raw-secret'));

      expect(harness.storage.artifactStore.redact(artifact, 'missing-hook')).toEqual({
        code: 'artifact-quarantined',
        health: 'ok',
        message: 'Redaction hook missing-hook could not be applied.',
      });
      expect(await harness.storage.artifactStore.putScratch(artifactInput('scratch-before-degrade'))).toEqual({
        code: 'network-fs-degraded',
        health: 'ok',
        message: 'Scratch artifacts are available only while storage health is ok.',
      });

      const replacement = harness.storage.artifactStore.redact(artifact, 'mask-all');
      expect(await readArtifactText(harness.storage, artifact, 'raw')).toBe('raw-secret');
      expect(
        await harness.storage.artifactStore.put(artifactInput('raw-secret', { producer: 'storage-conformance' })),
      ).toEqual({
        code: 'artifact-quarantined',
        health: 'ok',
        message: `Artifact ${artifact.id} is tombstoned and cannot be republished as raw evidence.`,
      });

      const rawManifest = harness.storage.artifactStore.export({
        artifactIds: [artifact.id],
        mode: 'raw',
      });
      expect(rawManifest).toMatchObject({
        redactionMode: 'raw',
        artifacts: [
          {
            id: artifact.id,
            redactionState: 'tombstoned',
          },
        ],
      });

      harness.storage.debug.corruptArtifact(replacement.id, encodeBytes('broken-redaction'));
      expect(
        harness.storage.artifactStore.export({
          artifactIds: [artifact.id],
        }),
      ).toEqual({
        code: 'export-incomplete-forbidden',
        health: 'ok',
        message: `Artifact ${artifact.id} could not be verified for export.`,
      });
    });
  });
};
