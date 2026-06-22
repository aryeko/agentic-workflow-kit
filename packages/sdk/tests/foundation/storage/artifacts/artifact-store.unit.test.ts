import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  collectArtifactStreamBytes,
  createInMemoryArtifactStore,
  isArtifactRefEvidenceEligible,
  isArtifactRefRetentionEligible,
  type ArtifactRef,
  type ExportManifest,
} from '../../../../src/foundation/storage/artifacts/index.js';
import {
  createEvidenceBundleManifest,
  isExportManifestRedactedByDefault,
} from '../../../../src/foundation/storage/evidence-bundles/index.js';
import type {
  ArtifactStore as RootArtifactStore,
  EvidenceBundleManifest as RootEvidenceBundleManifest,
  ExportManifest as RootExportManifest,
} from '../../../../src/index.js';

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const FIXED_CREATED_AT = new globalThis.Date('2026-06-22T10:00:00.000Z');
const FIXED_EXPIRES_AT = new globalThis.Date('2026-12-31T23:59:59.000Z');

const sha256Hex = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');

const createStore = (options?: Partial<Parameters<typeof createInMemoryArtifactStore>[0]>) =>
  createInMemoryArtifactStore({
    digestBytes: sha256Hex,
    now: () => FIXED_CREATED_AT,
    health: () => 'ok',
    classificationPolicy: (classification) => classification !== 'forbidden',
    sizeLimitBytes: 256,
    resolveLogRange: (range) => ({
      frameDigest: `${range.logId}:${range.fromSequence}-${range.toSequence}`,
    }),
    redactionHooks: {
      'mask-inline': ({ artifact }) => ({
        content: encoder.encode('redacted artifact'),
        classification: artifact.classification,
        mediaType: artifact.mediaType,
      }),
    },
    ...options,
  });

const putArtifact = (
  store: ReturnType<typeof createStore>,
  overrides?: Partial<Parameters<typeof store.put>[0]>,
): ArtifactRef | ReturnType<typeof store.put> => {
  const published = store.put({
    content: encoder.encode('artifact body'),
    mediaType: 'text/plain',
    retentionClass: 'run-evidence',
    classification: 'internal',
    producer: 'fnd-02-s4-test',
    expiry: FIXED_EXPIRES_AT,
    ...overrides,
  });

  return published;
};

describe('fnd-02-s4 artifact evidence store', () => {
  it('exposes artifact and evidence-bundle contracts from the root SDK barrel', () => {
    const rootExports: Partial<{
      readonly store: RootArtifactStore;
      readonly exportManifest: RootExportManifest;
      readonly bundleManifest: RootEvidenceBundleManifest;
    }> = {};

    expect(rootExports).toEqual({});
  });

  it('publishes immutable content-addressed artifacts with stable ids, digest metadata, and metadata evidence records', () => {
    const store = createStore();

    const published = putArtifact(store);
    expect(published).not.toHaveProperty('code');
    if ('code' in published) {
      throw new Error(published.message);
    }

    expect(published).toEqual({
      id: `artifact:sha256:${sha256Hex(encoder.encode('artifact body'))}`,
      digest: sha256Hex(encoder.encode('artifact body')),
      size: encoder.encode('artifact body').byteLength,
      mediaType: 'text/plain',
      retentionClass: 'run-evidence',
      classification: 'internal',
      redactionState: 'raw',
    });

    expect(store.resolve(published.id)).toEqual(published);
    expect(store.readArtifactMetadataRecord(published.id)).toEqual({
      id: published.id,
      digest: published.digest,
      size: published.size,
      mediaType: 'text/plain',
      retentionClass: 'run-evidence',
      classification: 'internal',
      producer: 'fnd-02-s4-test',
      redactionState: 'raw',
      createdAt: FIXED_CREATED_AT,
      expiry: FIXED_EXPIRES_AT,
      authoritative: true,
    });
    expect(isArtifactRefEvidenceEligible(published)).toBe(true);
    expect(isArtifactRefRetentionEligible(published)).toBe(true);
  });

  it('returns artifact-quarantined when size, classification, or digest verification fails and does not rewrite existing ids', async () => {
    const oversizedStore = createStore({ sizeLimitBytes: 4 });

    expect(putArtifact(oversizedStore)).toEqual({
      code: 'artifact-quarantined',
      health: 'ok',
      message: 'Artifact size exceeded the configured limit.',
    });

    const classifiedStore = createStore({
      classificationPolicy: (classification) => classification === 'public',
    });

    expect(putArtifact(classifiedStore)).toEqual({
      code: 'artifact-quarantined',
      health: 'ok',
      message: 'Artifact classification failed validation.',
    });

    const store = createStore();
    const published = putArtifact(store);
    if ('code' in published) {
      throw new Error(published.message);
    }

    store.debugCorruptArtifactBytes(published.id, encoder.encode('tampered body'));

    const corruptedRead = store.get(published, 'redacted');
    expect(corruptedRead).toEqual({
      code: 'artifact-quarantined',
      health: 'ok',
      message: `Artifact ${published.id} failed digest verification.`,
    });

    store.debugCorruptArtifactBytes(published.id, encoder.encode('artifact body'));
    const duplicatePut = putArtifact(store);
    if ('code' in duplicatePut) {
      throw new Error(duplicatePut.message);
    }
    expect(duplicatePut).toEqual(published);

    const stream = store.get(published, 'redacted');
    expect(stream).not.toHaveProperty('code');
    if ('code' in stream) {
      throw new Error(stream.message);
    }
    expect(decoder.decode(await collectArtifactStreamBytes(stream))).toBe('artifact body');
  });

  it('allows scratch refs only in degraded mode and bars them from resolve, evidence, export, and retention policy', () => {
    const healthyStore = createStore();
    expect(
      healthyStore.putScratch({
        content: encoder.encode('scratch artifact'),
        mediaType: 'text/plain',
        retentionClass: 'run-evidence',
        classification: 'internal',
        producer: 'fnd-02-s4-test',
      }),
    ).toEqual({
      code: 'network-fs-degraded',
      health: 'ok',
      message: 'Scratch artifacts are available only while storage health is network-fs-degraded.',
    });

    const degradedStore = createStore({ health: () => 'network-fs-degraded' });
    const scratch = degradedStore.putScratch({
      content: encoder.encode('scratch artifact'),
      mediaType: 'text/plain',
      retentionClass: 'run-evidence',
      classification: 'internal',
      producer: 'fnd-02-s4-test',
    });

    expect(scratch).not.toHaveProperty('code');
    if ('code' in scratch) {
      throw new Error(scratch.message);
    }

    expect(scratch).toEqual({
      id: `scratch:sha256:${sha256Hex(encoder.encode('scratch artifact'))}`,
      digest: sha256Hex(encoder.encode('scratch artifact')),
      size: encoder.encode('scratch artifact').byteLength,
      mediaType: 'text/plain',
      classification: 'internal',
      redactionState: 'raw',
    });
    expect(degradedStore.resolve(scratch.id)).toEqual({
      code: 'network-fs-degraded',
      health: 'network-fs-degraded',
      message: `Scratch artifact ${scratch.id} cannot satisfy authoritative artifact resolution.`,
    });
    expect(isArtifactRefEvidenceEligible(scratch)).toBe(false);
    expect(isArtifactRefRetentionEligible(scratch)).toBe(false);
    expect(degradedStore.export({ artifactIds: [scratch.id] })).toEqual({
      code: 'network-fs-degraded',
      health: 'network-fs-degraded',
      message: 'Authoritative export is unavailable while storage health is network-fs-degraded.',
    });
  });

  it('creates a redacted replacement and tombstone, denies normal reads of the original, and preserves raw access', async () => {
    const store = createStore();
    const published = putArtifact(store);
    if ('code' in published) {
      throw new Error(published.message);
    }

    const redacted = store.redact(published, 'mask-inline');
    expect(redacted).not.toHaveProperty('code');
    if ('code' in redacted) {
      throw new Error(redacted.message);
    }

    expect(redacted).toMatchObject({
      id: `artifact:sha256:${sha256Hex(encoder.encode('redacted artifact'))}`,
      digest: sha256Hex(encoder.encode('redacted artifact')),
      size: encoder.encode('redacted artifact').byteLength,
      mediaType: 'text/plain',
      retentionClass: 'run-evidence',
      classification: 'internal',
      redactionState: 'redacted',
    });
    expect(store.resolve(published.id)).toEqual({
      ...published,
      redactionState: 'tombstoned',
    });
    expect(store.readArtifactTombstones()).toEqual([
      {
        originalId: published.id,
        originalDigest: published.digest,
        replacementId: redacted.id,
        replacementDigest: redacted.digest,
        hookId: 'mask-inline',
        createdAt: FIXED_CREATED_AT,
      },
    ]);
    expect(store.get(published, 'redacted')).toEqual({
      code: 'artifact-quarantined',
      health: 'ok',
      message: `Artifact ${published.id} is tombstoned and unavailable for redacted reads.`,
    });

    const rawRead = store.get(published, 'raw');
    expect(rawRead).not.toHaveProperty('code');
    if ('code' in rawRead) {
      throw new Error(rawRead.message);
    }
    expect(decoder.decode(await collectArtifactStreamBytes(rawRead))).toBe('artifact body');
  });

  it('exports redacted replacements for tombstoned originals by default and fails closed when replacement evidence is unavailable', () => {
    const store = createStore();
    const published = putArtifact(store);
    if ('code' in published) {
      throw new Error(published.message);
    }

    const redacted = store.redact(published, 'mask-inline');
    if ('code' in redacted) {
      throw new Error(redacted.message);
    }

    const manifest = store.export({ artifactIds: [published.id] });
    expect(manifest).not.toHaveProperty('code');
    if ('code' in manifest) {
      throw new Error(manifest.message);
    }

    expect(manifest.redactionMode).toBe('redacted');
    expect(manifest.artifacts).toEqual([
      {
        id: redacted.id,
        digest: redacted.digest,
        size: redacted.size,
        redactionState: 'redacted',
      },
    ]);
    expect(manifest.artifacts.map((artifact) => artifact.digest)).not.toContain(published.digest);

    const rawManifest = store.export({ artifactIds: [published.id], mode: 'raw' });
    expect(rawManifest).not.toHaveProperty('code');
    if ('code' in rawManifest) {
      throw new Error(rawManifest.message);
    }
    expect(rawManifest.artifacts).toEqual([
      {
        id: published.id,
        digest: published.digest,
        size: published.size,
        redactionState: 'tombstoned',
      },
    ]);

    store.debugDeleteArtifactBytes(redacted.id);
    expect(store.export({ artifactIds: [published.id] })).toEqual({
      code: 'export-incomplete-forbidden',
      health: 'ok',
      message: `Artifact ${published.id} redaction replacement could not be verified for export.`,
    });
  });

  it('builds a stable redacted-by-default export manifest and a bundle manifest with sorted refs, digests, sizes, log ranges, and log health', () => {
    const store = createStore({ health: () => 'log-tail-repaired' });
    const alpha = putArtifact(store, { content: encoder.encode('alpha') });
    const beta = putArtifact(store, { content: encoder.encode('beta') });
    if ('code' in alpha || 'code' in beta) {
      throw new Error('Expected authoritative artifacts.');
    }

    const manifest = store.export({
      artifactIds: [beta.id, alpha.id],
      logRanges: [
        { logId: 'run-b', fromSequence: 5, toSequence: 9 },
        { logId: 'run-a', fromSequence: 1, toSequence: 4 },
      ],
    });

    expect(manifest).not.toHaveProperty('code');
    if ('code' in manifest) {
      throw new Error(manifest.message);
    }

    const expectedManifest: ExportManifest = {
      createdAt: FIXED_CREATED_AT,
      redactionMode: 'redacted',
      logHealth: 'log-tail-repaired',
      artifacts: [
        {
          id: alpha.id,
          digest: alpha.digest,
          size: alpha.size,
          redactionState: 'raw',
        },
        {
          id: beta.id,
          digest: beta.digest,
          size: beta.size,
          redactionState: 'raw',
        },
      ],
      logRanges: [
        {
          logId: 'run-a',
          fromSequence: 1,
          toSequence: 4,
          frameDigest: 'run-a:1-4',
        },
        {
          logId: 'run-b',
          fromSequence: 5,
          toSequence: 9,
          frameDigest: 'run-b:5-9',
        },
      ],
    };

    expect(manifest).toEqual(expectedManifest);
    expect(isExportManifestRedactedByDefault(manifest)).toBe(true);
    expect(createEvidenceBundleManifest(manifest)).toEqual({
      manifestVersion: '1',
      exportManifest: expectedManifest,
      artifactCount: 2,
      digests: [alpha.digest, beta.digest],
      stableArtifactIds: [alpha.id, beta.id],
    });
  });

  it('fails closed with export-incomplete-forbidden when a selected artifact or log range cannot be verified', () => {
    const artifactStore = createStore();
    const published = putArtifact(artifactStore);
    if ('code' in published) {
      throw new Error(published.message);
    }

    artifactStore.debugDeleteArtifactBytes(published.id);
    expect(artifactStore.export({ artifactIds: [published.id] })).toEqual({
      code: 'export-incomplete-forbidden',
      health: 'ok',
      message: `Artifact ${published.id} could not be verified for export.`,
    });

    const rangeStore = createStore({
      resolveLogRange: () => undefined,
    });
    const rangeArtifact = putArtifact(rangeStore);
    if ('code' in rangeArtifact) {
      throw new Error(rangeArtifact.message);
    }

    expect(
      rangeStore.export({
        artifactIds: [rangeArtifact.id],
        logRanges: [{ logId: 'run-a', fromSequence: 1, toSequence: 3 }],
      }),
    ).toEqual({
      code: 'export-incomplete-forbidden',
      health: 'ok',
      message: 'Log range run-a:1-3 could not be verified for export.',
    });
  });
});
