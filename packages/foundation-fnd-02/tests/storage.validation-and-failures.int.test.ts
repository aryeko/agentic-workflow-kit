import { createHash } from 'node:crypto';
import { mkdtemp, readdir, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  type ArtifactRef,
  createFileSystemStorageRoot,
  type FileSystemStorageRootOptions,
  type IdGenerator,
  isStorageError,
  type StorageClock,
  type TokenGenerator,
} from '../src/index.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

class ManualClock implements StorageClock {
  #ms: number;

  constructor(iso: string) {
    this.#ms = Date.parse(iso);
  }

  now(): Date {
    return new Date(this.#ms);
  }

  advance(ms: number): void {
    this.#ms += ms;
  }
}

class SequenceGenerator implements IdGenerator, TokenGenerator {
  #next = 0;

  nextId(purpose: string): string {
    this.#next += 1;
    return `${purpose}-${this.#next}`;
  }

  nextToken(purpose: string): string {
    this.#next += 1;
    return `${purpose}-token-${this.#next}`;
  }
}

const tempRoots: string[] = [];

const makeRoot = async (
  options: Partial<Omit<FileSystemStorageRootOptions, 'root' | 'clock' | 'idGenerator' | 'tokenGenerator'>> = {},
) => {
  const root = await mkdtemp(join(tmpdir(), 'fnd-02-'));
  tempRoots.push(root);
  const clock = new ManualClock('2026-06-19T00:00:00.000Z');
  const generator = new SequenceGenerator();
  const storage = createFileSystemStorageRoot({
    root,
    clock,
    idGenerator: generator,
    tokenGenerator: generator,
    ...options,
  });

  return { root, clock, storage };
};

const bytes = (value: string): Uint8Array => encoder.encode(value);

const text = (content: Uint8Array): string => decoder.decode(content);

const digest = (content: Uint8Array | string): string => createHash('sha256').update(content).digest('hex');

const canonicalJson = (value: unknown): string => JSON.stringify(sortForJson(value));

const digestJson = (value: unknown): string => digest(canonicalJson(value));

const sortForJson = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sortForJson(item));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, sortForJson(entryValue)]),
    );
  }
  return value;
};

const expectStorageError = <T>(value: T, code: string) => {
  expect(isStorageError(value)).toBe(true);
  if (!isStorageError(value)) {
    throw new Error('expected storage error');
  }
  expect(value.code).toBe(code);
  return value;
};

const _findOnlyFile = async (root: string, directory: string): Promise<string> => {
  const entries = await readdir(join(root, directory), { recursive: true, withFileTypes: true });
  const files = entries.filter((entry) => entry.isFile()).map((entry) => join(entry.parentPath, entry.name));
  expect(files).toHaveLength(1);
  return files[0] ?? '';
};

const _leaseGuardFile = (root: string, name: string): string => join(root, 'leases', `${digest(name)}.guard`);

const leaseRecordFile = (root: string, name: string): string => join(root, 'leases', `${digest(name)}.json`);

const artifactMetadataFile = (root: string, id: string): string =>
  join(root, 'artifacts', 'metadata', `${digest(id)}.json`);

const logFile = (root: string, logId: string): string => join(root, 'logs', `${digest(logId)}.jsonl`);

const _guardRecord = (name: string, guardExpiresAt: string, holder: string) => ({
  schema: 'kit-vnext.lease-guard.v1',
  name,
  holder,
  operationId: `${holder}-operation`,
  operation: 'acquire',
  guardExpiresAt,
});

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('filesystem storage root', () => {
  it('exports redacted manifests with stable ordering and verifies selected blobs', async () => {
    const operations: string[] = [];
    const { root, storage } = await makeRoot({
      redactionHooks: new Map([['mask', () => bytes('redacted-alpha')]]),
      durabilityObserver: (event) => operations.push(`${event.operation}:${event.path}`),
    });
    const alpha = storage.artifacts.put({
      content: bytes('alpha'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'sensitive',
    });
    const beta = storage.artifacts.put({
      content: bytes('beta'),
      mediaType: 'text/plain',
      retentionClass: 'report',
      classification: 'internal',
    });
    expect(isStorageError(alpha)).toBe(false);
    expect(isStorageError(beta)).toBe(false);
    if (isStorageError(alpha) || isStorageError(beta)) {
      return;
    }
    const redactedAlpha = storage.artifacts.redact(alpha, 'mask');
    expect(isStorageError(redactedAlpha)).toBe(false);
    if (isStorageError(redactedAlpha)) {
      return;
    }

    const lease = storage.leases.acquire('run-writer:export', 'worker-a', 60_000);
    expect(isStorageError(lease)).toBe(false);
    if (isStorageError(lease)) {
      return;
    }
    const handle = storage.eventLog.openForAppend('run:export', lease);
    expect(isStorageError(handle)).toBe(false);
    if (isStorageError(handle)) {
      return;
    }
    storage.eventLog.append(handle, {
      expectedSequence: 1,
      durability: 'barrier',
      payloads: [bytes('export-event')],
    });

    operations.splice(0);
    const manifest = storage.artifacts.export({ artifactIds: [beta.id, alpha.id], logIds: ['run:export'] });
    expect(isStorageError(manifest)).toBe(false);
    if (isStorageError(manifest)) {
      return;
    }
    expect(manifest.schema).toBe('kit-vnext.storage-export.v1');
    expect(manifest.logs).toEqual([
      {
        logId: 'run:export',
        health: 'ok',
        firstSequence: 1,
        lastSequence: 1,
        recordCount: 1,
      },
    ]);
    expect(manifest.artifacts.map((artifact) => artifact.id)).toEqual([redactedAlpha.id, beta.id]);
    expect(manifest.artifacts.map((artifact) => artifact.redactionState)).toEqual(['redacted', 'raw']);
    expect(
      operations.some(
        (operation) =>
          operation.startsWith(`fsync-file:${join(root, 'artifacts', 'exports')}`) && operation.endsWith('.tmp'),
      ),
    ).toBe(true);
    expect(operations).toContain(`fsync-directory:${join(root, 'artifacts', 'exports')}`);
    expect(operations.some((operation) => operation.endsWith('.json'))).toBe(false);

    const blobPath = await artifactBlobPath(root, beta);
    await writeFile(blobPath, 'tampered');
    expectStorageError(storage.artifacts.export({ artifactIds: [beta.id] }), 'export-incomplete-forbidden');
  });

  it('fails closed on invalid artifact, lease, and append inputs', async () => {
    const { storage, clock } = await makeRoot({
      maxArtifactBytes: 4,
      redactionHooks: new Map([['mask', (content) => content]]),
    });

    expectStorageError(
      storage.artifacts.put({
        content: bytes('abc'),
        mediaType: '',
        retentionClass: 'evidence',
        classification: 'internal',
      }),
      'invalid-input',
    );
    expectStorageError(
      storage.artifacts.put({
        content: bytes('abc'),
        mediaType: 'text/plain',
        retentionClass: 'evidence',
        classification: 'internal',
        redactionHookId: 'missing',
      }),
      'artifact-quarantined',
    );
    const redacted = storage.artifacts.put({
      content: bytes('abc'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'internal',
      redactionHookId: 'mask',
    });
    expect(isStorageError(redacted)).toBe(false);
    if (isStorageError(redacted)) {
      return;
    }
    expect(redacted.redactionState).toBe('redacted');
    const redactedContent = storage.artifacts.get(redacted, 'redacted');
    expect(isStorageError(redactedContent)).toBe(false);
    if (isStorageError(redactedContent)) {
      return;
    }
    expect(text(redactedContent.bytes)).toBe('abc');
    expectStorageError(
      storage.artifacts.put({
        content: bytes('too-large'),
        mediaType: 'text/plain',
        retentionClass: 'evidence',
        classification: 'internal',
      }),
      'artifact-quarantined',
    );
    expectStorageError(
      storage.artifacts.putScratch({
        content: bytes('too-large'),
        mediaType: 'text/plain',
        retentionClass: 'scratch',
        classification: 'internal',
      }),
      'artifact-quarantined',
    );
    const redactedScratch = storage.artifacts.putScratch({
      content: bytes('abc'),
      mediaType: 'text/plain',
      retentionClass: 'scratch',
      classification: 'internal',
      redactionHookId: 'mask',
    });
    expect(isStorageError(redactedScratch)).toBe(false);
    if (isStorageError(redactedScratch)) {
      return;
    }
    expect(redactedScratch.redactionState).toBe('redacted');
    expectStorageError(storage.artifacts.resolve('scratch:temporary'), 'not-found');
    expectStorageError(
      storage.artifacts.get(
        {
          id: 'artifact:missing',
          digest: digest('missing'),
          size: 7,
          mediaType: 'text/plain',
          retentionClass: 'evidence',
          classification: 'internal',
          redactionState: 'raw',
        },
        'raw',
      ),
      'not-found',
    );

    expectStorageError(storage.leases.acquire('', 'holder', 60_000), 'invalid-input');
    expectStorageError(storage.leases.acquire('lease:bad-ttl', 'holder', 0), 'invalid-input');
    const lease = storage.leases.acquire('lease:valid', 'holder', 60_000);
    expect(isStorageError(lease)).toBe(false);
    if (isStorageError(lease)) {
      return;
    }
    const releasable = storage.leases.acquire('lease:release', 'holder', 60_000);
    expect(isStorageError(releasable)).toBe(false);
    if (isStorageError(releasable)) {
      return;
    }
    expectStorageError(storage.leases.acquire('lease:valid', 'other', 60_000), 'lease-unavailable');
    expectStorageError(storage.leases.renew('lease:valid', lease.epoch, 'wrong-token', 60_000), 'lease-unavailable');
    expectStorageError(storage.leases.release('lease:valid', lease.epoch, 'wrong-token'), 'lease-unavailable');
    expect(isStorageError(storage.leases.renew('lease:valid', lease.epoch, lease.token, 60_000))).toBe(false);
    expect(storage.leases.release('lease:release', releasable.epoch, releasable.token)).toBeUndefined();
    expectStorageError(storage.leases.renew('lease:missing', 1, 'token', 60_000), 'lease-unavailable');
    expect(storage.leases.fence('lease:missing', 1, 'token')).toBe(false);

    const handle = storage.eventLog.openForAppend('run:invalid', lease);
    expect(isStorageError(handle)).toBe(false);
    if (isStorageError(handle)) {
      return;
    }
    expectStorageError(
      storage.eventLog.append(handle, { expectedSequence: 0, durability: 'durable', payloads: [bytes('bad')] }),
      'invalid-input',
    );
    expectStorageError(
      storage.eventLog.append(handle, { expectedSequence: 1, durability: 'durable', payloads: [] }),
      'invalid-input',
    );

    clock.advance(60_001);
    expectStorageError(storage.leases.renew('lease:valid', lease.epoch, lease.token, 60_000), 'lease-unavailable');
  });

  it('returns buffered acknowledgements and rejects sequence conflicts', async () => {
    const { storage } = await makeRoot();
    const lease = storage.leases.acquire('run-writer:buffered', 'worker-a', 60_000);
    expect(isStorageError(lease)).toBe(false);
    if (isStorageError(lease)) {
      return;
    }
    const handle = storage.eventLog.openForAppend('run:buffered', lease);
    expect(isStorageError(handle)).toBe(false);
    if (isStorageError(handle)) {
      return;
    }

    const buffered = storage.eventLog.append(handle, {
      expectedSequence: 1,
      durability: 'buffered',
      payloads: [bytes('buffered')],
    });
    expect(isStorageError(buffered)).toBe(false);
    if (isStorageError(buffered)) {
      return;
    }
    expect(buffered.kind).toBe('non-durable-ack');

    expectStorageError(
      storage.eventLog.append(handle, { expectedSequence: 1, durability: 'durable', payloads: [bytes('conflict')] }),
      'sequence-conflict',
    );
  });

  it('allows explicit raw access to tombstoned artifacts when configured', async () => {
    const { storage } = await makeRoot({
      allowRawTombstoneAccess: true,
      redactionHooks: new Map([['mask', () => bytes('redacted')]]),
    });
    const raw = storage.artifacts.put({
      content: bytes('secret'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'sensitive',
    });
    expect(isStorageError(raw)).toBe(false);
    if (isStorageError(raw)) {
      return;
    }
    expect(isStorageError(storage.artifacts.redact(raw, 'mask'))).toBe(false);
    const tombstoned = storage.artifacts.resolve(raw.id);
    expect(isStorageError(tombstoned)).toBe(false);
    if (isStorageError(tombstoned)) {
      return;
    }

    const originalBytes = storage.artifacts.get(tombstoned, 'raw');
    expect(isStorageError(originalBytes)).toBe(false);
    if (isStorageError(originalBytes)) {
      return;
    }
    expect(text(originalBytes.bytes)).toBe('secret');
  });

  it('rejects corrupted artifact metadata and missing blobs', async () => {
    const { root, storage } = await makeRoot();
    const first = storage.artifacts.put({
      content: bytes('first'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'internal',
    });
    const second = storage.artifacts.put({
      content: bytes('second'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'internal',
    });
    expect(isStorageError(first)).toBe(false);
    expect(isStorageError(second)).toBe(false);
    if (isStorageError(first) || isStorageError(second)) {
      return;
    }

    await unlink(await artifactBlobPath(root, first));
    expectStorageError(storage.artifacts.get(first, 'raw'), 'artifact-quarantined');

    const metadataFiles = await readdir(join(root, 'artifacts', 'metadata'), { withFileTypes: true });
    const metadataPath = join(root, 'artifacts', 'metadata', metadataFiles[0]?.name ?? '');
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as Record<string, unknown>;
    await writeFile(metadataPath, `${JSON.stringify({ ...metadata, recordDigest: 'sha256:wrong' })}\n`);
    expectStorageError(storage.artifacts.resolve(String(metadata.id)), 'not-found');
  });

  it('rejects stale log handles and log appends while degraded', async () => {
    const { storage, clock } = await makeRoot();
    const firstLease = storage.leases.acquire('run-writer:stale-open', 'worker-a', 100);
    expect(isStorageError(firstLease)).toBe(false);
    if (isStorageError(firstLease)) {
      return;
    }
    clock.advance(101);
    expect(isStorageError(storage.leases.acquire('run-writer:stale-open', 'worker-b', 60_000))).toBe(false);
    expectStorageError(storage.eventLog.openForAppend('run:stale-open', firstLease), 'stale-writer-fenced');

    const degraded = await makeRoot({ probe: () => 'read-only' });
    const handle = { logId: 'run:degraded', leaseName: 'lease', epoch: 1, token: 'token' };
    expectStorageError(
      degraded.storage.eventLog.openForAppend('run:degraded', {
        name: 'lease',
        epoch: 1,
        token: 'token',
        expiresAt: new Date('2026-06-19T00:01:00.000Z'),
      }),
      'storage-unavailable',
    );
    expectStorageError(
      degraded.storage.eventLog.append(handle, { expectedSequence: 1, durability: 'durable', payloads: [bytes('x')] }),
      'storage-unavailable',
    );
    expectStorageError(
      degraded.storage.artifacts.put({
        content: bytes('x'),
        mediaType: 'text/plain',
        retentionClass: 'evidence',
        classification: 'internal',
      }),
      'storage-unavailable',
    );
  });

  it('exports empty logs and fails closed on corrupt logs, leases, and tombstone replacement drift', async () => {
    const { root, storage } = await makeRoot({
      allowRawTombstoneAccess: true,
      redactionHooks: new Map([['mask', () => bytes('redacted')]]),
    });

    const lease = storage.leases.acquire('lease:corrupt', 'worker-a', 60_000);
    expect(isStorageError(lease)).toBe(false);
    if (isStorageError(lease)) {
      return;
    }
    await writeFile(leaseRecordFile(root, 'lease:corrupt'), '{"not": "a lease"}\n');
    expect(storage.leases.read('lease:corrupt').health).toBe('unusable');
    expect(storage.leases.fence('lease:corrupt', lease.epoch, lease.token)).toBe(false);

    const emptyExport = storage.artifacts.export({ logIds: ['run:empty'] });
    expect(isStorageError(emptyExport)).toBe(false);
    if (isStorageError(emptyExport)) {
      return;
    }
    expect(emptyExport.logs).toEqual([{ logId: 'run:empty', health: 'ok', recordCount: 0 }]);

    await writeFile(logFile(root, 'run:invalid-json'), '{"kind": "record"}\n');
    expect(storage.eventLog.replay('run:invalid-json').health).toBe('log-tail-repaired');

    const original = storage.artifacts.put({
      content: bytes('secret'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'sensitive',
      expiresAt: new Date('2026-06-20T00:00:00.000Z'),
    });
    expect(isStorageError(original)).toBe(false);
    if (isStorageError(original)) {
      return;
    }
    const redacted = storage.artifacts.redact(original, 'mask');
    expect(isStorageError(redacted)).toBe(false);
    if (isStorageError(redacted)) {
      return;
    }
    const tombstoned = storage.artifacts.resolve(original.id);
    expect(isStorageError(tombstoned)).toBe(false);
    if (isStorageError(tombstoned)) {
      return;
    }
    const rawManifest = storage.artifacts.export({ artifactIds: [tombstoned.id], includeRawTombstoned: true });
    expect(isStorageError(rawManifest)).toBe(false);
    if (isStorageError(rawManifest)) {
      return;
    }
    expect(rawManifest.artifacts).toMatchObject([{ id: tombstoned.id, redactionState: 'redacted' }]);
    expect(storage.artifacts.export({ artifactIds: [tombstoned.id], includeRawTombstoned: true })).toMatchObject({
      id: rawManifest.id,
    });

    const metadataPath = artifactMetadataFile(root, original.id);
    const metadata = JSON.parse(await readFile(metadataPath, 'utf8')) as Record<string, unknown>;
    const withoutReplacement: Record<string, unknown> = {
      ...metadata,
      replacementId: undefined,
      replacementDigest: undefined,
    };
    const { recordDigest: _recordDigest, ...digestInput } = withoutReplacement;
    await writeFile(
      metadataPath,
      `${JSON.stringify({ ...withoutReplacement, recordDigest: digestJson(digestInput) })}\n`,
    );
    expectStorageError(storage.artifacts.export({ artifactIds: [tombstoned.id] }), 'export-incomplete-forbidden');

    const badReplacement: Record<string, unknown> = { ...metadata, replacementId: 'artifact:missing' };
    const { recordDigest: _badDigest, ...badDigestInput } = badReplacement;
    await writeFile(
      metadataPath,
      `${JSON.stringify({ ...badReplacement, recordDigest: digestJson(badDigestInput) })}\n`,
    );
    expectStorageError(storage.artifacts.export({ artifactIds: [tombstoned.id] }), 'export-incomplete-forbidden');
    expectStorageError(storage.artifacts.export({ artifactIds: ['scratch:temporary'] }), 'export-incomplete-forbidden');
    expectStorageError(storage.artifacts.export({ artifactIds: ['artifact:missing'] }), 'export-incomplete-forbidden');
  });

  it('fails closed when artifact redaction cannot resolve, read, or commit replacement content', async () => {
    const missingHook = await makeRoot();
    const raw = missingHook.storage.artifacts.put({
      content: bytes('secret'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'sensitive',
    });
    expect(isStorageError(raw)).toBe(false);
    if (isStorageError(raw)) {
      return;
    }
    expectStorageError(missingHook.storage.artifacts.redact(raw, 'missing'), 'artifact-quarantined');

    const missingBlob = await makeRoot({ redactionHooks: new Map([['mask', () => bytes('redacted')]]) });
    const blobRaw = missingBlob.storage.artifacts.put({
      content: bytes('secret'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'sensitive',
    });
    expect(isStorageError(blobRaw)).toBe(false);
    if (isStorageError(blobRaw)) {
      return;
    }
    await unlink(await artifactBlobPath(missingBlob.root, blobRaw));
    expectStorageError(missingBlob.storage.artifacts.redact(blobRaw, 'mask'), 'artifact-quarantined');

    const oversize = await makeRoot({
      maxArtifactBytes: 3,
      redactionHooks: new Map([['mask', () => bytes('too-large')]]),
    });
    const tooLargeRedaction = oversize.storage.artifacts.put({
      content: bytes('abc'),
      mediaType: 'text/plain',
      retentionClass: 'evidence',
      classification: 'sensitive',
      redactionHookId: 'mask',
    });
    expectStorageError(tooLargeRedaction, 'artifact-quarantined');
  });
});

const artifactBlobPath = async (root: string, ref: ArtifactRef): Promise<string> => {
  const entries = await readdir(join(root, 'artifacts', 'blobs'), { recursive: true, withFileTypes: true });
  const match = entries.find((entry) => entry.isFile() && entry.name === ref.digest);
  if (!match) {
    throw new Error(`missing artifact blob ${ref.digest}`);
  }
  return join(match.parentPath, match.name);
};

const _scratchBlobPath = (root: string, id: string): string => join(root, 'artifacts', 'scratch', `${digest(id)}.blob`);
