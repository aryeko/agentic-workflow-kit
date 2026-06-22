import { describe, expect, it } from 'vitest';

import {
  createArtifactId,
  createFakeFilesystemBackend,
  createFaultInjectingFilesystemBackend,
  openFilesystemStorage,
} from '../../../../src/index.js';
import {
  artifactInput,
  digestBytes,
  digestToken,
  encodeBytes,
  runFilesystemConformanceSuite,
  textDecoder,
  type FilesystemConformanceHarness,
} from '../../../fixtures/storage/filesystem-fixture-helpers.ts';
import { STORAGE_CONFORMANCE_FIXTURE_CATALOG } from '../../../fixtures/storage/filesystem-fixture-catalog.ts';

const createHarness = (): FilesystemConformanceHarness => {
  const backend = createFakeFilesystemBackend();
  const commonOptions = {
    digestBytes,
    digestToken,
    createToken: (() => {
      let next = 0;
      return () => `token-${++next}`;
    })(),
    now: (() => {
      let next = 0;
      return () => new Date(Date.UTC(2026, 5, 22, 0, 0, next++));
    })(),
    redactionHooks: {
      'mask-all': () => ({
        content: encodeBytes('[REDACTED]'),
      }),
    },
    backend,
  };
  const storage = openFilesystemStorage(commonOptions);
  return {
    storage,
    reopen: () =>
      openFilesystemStorage({
        ...commonOptions,
        backend,
      }),
  };
};

runFilesystemConformanceSuite('filesystem conformance with deterministic fake backend', createHarness);

const createCommonOptions = (backend: ReturnType<typeof createFakeFilesystemBackend>) => ({
  backend,
  digestBytes,
  digestToken,
  createToken: (() => {
    let next = 0;
    return () => `token-${++next}`;
  })(),
  now: (() => {
    let next = 0;
    return () => new Date(Date.UTC(2026, 5, 22, 0, 0, next++));
  })(),
  redactionHooks: {
    'mask-all': () => ({
      content: encodeBytes('[REDACTED]'),
    }),
    'same-id': ({ bytes }: { readonly bytes: Uint8Array }) => ({
      content: bytes,
    }),
    'blocked-classification': () => ({
      content: encodeBytes('blocked'),
      classification: 'blocked',
    }),
  },
});

const encodeJson = (value: unknown): Uint8Array => encodeBytes(JSON.stringify(value));
const parseJson = <T>(bytes: Uint8Array | undefined): T | undefined => {
  if (bytes === undefined) {
    return undefined;
  }

  return JSON.parse(textDecoder.decode(bytes)) as T;
};

describe('fnd-02-s5 filesystem conformance fixtures', () => {
  it('surfaces deterministic fake-backend errors for missing rename, fsync, and corruption targets', () => {
    const backend = createFakeFilesystemBackend();

    expect(() => backend.rename('/missing.from', '/missing.to')).toThrow(/ENOENT/);
    expect(() => backend.fsyncFile('/missing.file')).toThrow(/ENOENT/);
    expect(() => backend.corruptFile('/missing.file', encodeBytes('oops'))).toThrow(/ENOENT/);
  });

  it('records a complete fixture catalog for the storage conformance suite', () => {
    expect(STORAGE_CONFORMANCE_FIXTURE_CATALOG).toEqual([
      'probe-matrix',
      'degraded-open',
      'append-replay-equivalence',
      'lease-fencing',
      'lease-unavailable-guarded-update',
      'artifact-immutability',
      'redaction-tombstones',
      'scratch-refs',
      'export-verification-refusal',
      'storage-degradation',
      'lane-guard',
    ]);
  });

  it('proves the open-time probe matrix before authoritative writes begin', () => {
    const storage = createHarness().storage;

    expect(storage.getProbeResults()).toEqual([
      { probe: 'atomic-rename', ok: true },
      { probe: 'exclusive-create', ok: true },
      { probe: 'file-fsync', ok: true },
      { probe: 'directory-fsync', ok: true },
      { probe: 'lease-cas', ok: true },
    ]);
    expect(storage.getHealth()).toBe('ok');
  });

  it('enters network-fs-degraded during open when a required probe cannot be proven', async () => {
    const storage = openFilesystemStorage({
      backend: createFaultInjectingFilesystemBackend({
        backend: createFakeFilesystemBackend(),
        faults: [{ operation: 'fsync-directory', pathIncludes: '/.probes', times: 1 }],
      }),
      digestBytes,
      digestToken,
      createToken: () => 'token-open',
      now: () => new Date('2026-06-22T00:00:00.000Z'),
    });

    expect(storage.getHealth()).toBe('network-fs-degraded');
    expect(storage.getProbeResults()).toContainEqual({ probe: 'atomic-rename', ok: false });

    expect(storage.leaseStore.acquire('run-writer:open', 'holder', 60_000)).toEqual({
      code: 'network-fs-degraded',
      health: 'network-fs-degraded',
      message: 'Authoritative lease is unavailable while storage health is network-fs-degraded.',
    });

    const artifact = await storage.artifactStore.put(artifactInput('blocked'));
    expect(artifact).toEqual({
      code: 'network-fs-degraded',
      health: 'network-fs-degraded',
      message: 'Authoritative evidence-ref is unavailable while storage health is network-fs-degraded.',
    });

    const scratch = await storage.artifactStore.putScratch(artifactInput('scratch-only'));
    expect(scratch).toMatchObject({
      id: expect.stringMatching(/^scratch:sha256:/),
      redactionState: 'raw',
    });
  });

  it('degrades on mid-operation event-log fsync failure and invalidates authoritative append', () => {
    const storage = openFilesystemStorage({
      backend: createFaultInjectingFilesystemBackend({
        backend: createFakeFilesystemBackend(),
        faults: [{ operation: 'fsync-file', pathIncludes: '/logs/', times: 1, afterProbePhase: true }],
      }),
      digestBytes,
      digestToken,
      createToken: () => 'token-log',
      now: () => new Date('2026-06-22T00:00:00.000Z'),
    });

    const lease = storage.leaseStore.acquire('run-writer:log', 'holder', 60_000);
    expect(lease).toMatchObject({ epoch: 1 });

    const handle = storage.eventLogStore.openForAppend('mid-op-log', {
      name: lease.name,
      epoch: lease.epoch,
      token: lease.token,
    });

    expect(
      storage.eventLogStore.append(handle, {
        expectedSequence: 1,
        durability: 'durable',
        payloads: [encodeBytes('will-fail')],
      }),
    ).toEqual({
      code: 'network-fs-degraded',
      health: 'network-fs-degraded',
      message: 'Authoritative append is unavailable while storage health is network-fs-degraded.',
    });
    expect(storage.getHealth()).toBe('network-fs-degraded');
    expect(storage.eventLogStore.replay('mid-op-log')).toEqual({
      health: 'network-fs-degraded',
      records: [],
    });
  });

  it('returns lease-unavailable when a guarded update cannot be proven and then refuses new lease issuance', () => {
    const storage = openFilesystemStorage({
      backend: createFaultInjectingFilesystemBackend({
        backend: createFakeFilesystemBackend(),
        faults: [{ operation: 'rename', pathIncludes: '/leases/', times: 1, afterProbePhase: true }],
      }),
      digestBytes,
      digestToken,
      createToken: () => 'token-lease',
      now: () => new Date('2026-06-22T00:00:00.000Z'),
    });

    expect(storage.leaseStore.acquire('run-writer:lease', 'holder', 60_000)).toEqual({
      code: 'lease-unavailable',
      health: 'network-fs-degraded',
      message: 'Lease acquire could not prove the guarded update.',
    });
    expect(storage.getHealth()).toBe('network-fs-degraded');
    expect(storage.leaseStore.acquire('run-writer:lease', 'holder', 60_000)).toEqual({
      code: 'network-fs-degraded',
      health: 'network-fs-degraded',
      message: 'Authoritative lease is unavailable while storage health is network-fs-degraded.',
    });
  });

  it('quarantines partial artifacts on exclusive-create failure and refuses authoritative resolution', async () => {
    const storage = openFilesystemStorage({
      backend: createFaultInjectingFilesystemBackend({
        backend: createFakeFilesystemBackend(),
        faults: [{ operation: 'write-exclusive', pathIncludes: '/artifacts/blobs/', times: 1, afterProbePhase: true }],
      }),
      digestBytes,
      digestToken,
      createToken: () => 'token-artifact',
      now: () => new Date('2026-06-22T00:00:00.000Z'),
    });

    const failed = await storage.artifactStore.put(artifactInput('partial artifact'));
    expect(failed).toEqual({
      code: 'artifact-quarantined',
      health: 'network-fs-degraded',
      message: 'Artifact publish left partial output in quarantine.',
    });
    expect(storage.getHealth()).toBe('network-fs-degraded');
    expect(storage.debug.listQuarantinedEntries()).not.toHaveLength(0);
  });

  it.each([
    {
      label: 'original metadata tombstone publish',
      faultPath: `/artifacts/meta/${encodeURIComponent(
        `artifact:sha256:${digestBytes(encodeBytes('redaction-target'))}`,
      )}.json`,
      expectedMessage: 'Artifact redaction left partial output in quarantine.',
    },
    {
      label: 'tombstone record publish',
      faultPath: '/artifacts/tombstones/',
      expectedMessage: 'Artifact redaction left partial output in quarantine.',
    },
  ])('quarantines partial artifacts when redaction cannot persist %s', async ({ faultPath, expectedMessage }) => {
    const backend = createFakeFilesystemBackend();
    const seededStorage = openFilesystemStorage(createCommonOptions(backend));
    const artifact = await seededStorage.artifactStore.put(artifactInput('redaction-target'));

    const storage = openFilesystemStorage({
      ...createCommonOptions(backend),
      backend: createFaultInjectingFilesystemBackend({
        backend,
        faults: [{ operation: 'rename', pathIncludes: faultPath, times: 1, afterProbePhase: true }],
      }),
    });

    const redacted = storage.artifactStore.redact(artifact, 'mask-all');

    expect(redacted).toEqual({
      code: 'artifact-quarantined',
      health: 'network-fs-degraded',
      message: expectedMessage,
    });
    expect(storage.getHealth()).toBe('network-fs-degraded');
    expect(storage.debug.listQuarantinedEntries()).not.toHaveLength(0);
  });

  it('keeps scratch refs non-authoritative even when storage is already degraded', async () => {
    const storage = openFilesystemStorage({
      backend: createFaultInjectingFilesystemBackend({
        backend: createFakeFilesystemBackend(),
        faults: [{ operation: 'fsync-directory', pathIncludes: '/.probes', times: 1 }],
      }),
      digestBytes,
      digestToken,
      createToken: () => 'token-scratch',
      now: () => new Date('2026-06-22T00:00:00.000Z'),
    });

    const first = await storage.artifactStore.putScratch(artifactInput('scratch content'));
    const second = await storage.artifactStore.putScratch(artifactInput('scratch content'));

    expect(second).toEqual(first);
    expect(storage.artifactStore.resolve(first.id)).toEqual({
      code: 'network-fs-degraded',
      health: 'network-fs-degraded',
      message: `Scratch artifact ${first.id} cannot satisfy authoritative artifact resolution.`,
    });
  });

  it('uses default clock and token helpers while enforcing size and classification validation', async () => {
    const storage = openFilesystemStorage({
      backend: createFakeFilesystemBackend(),
      digestBytes,
      digestToken,
      sizeLimitBytes: 3,
      classificationPolicy: (classification) => classification !== 'blocked',
    });

    const lease = storage.leaseStore.acquire('run-writer:defaults', 'holder', 1_000);
    expect(lease).toMatchObject({
      name: 'run-writer:defaults',
      epoch: 1,
      token: expect.any(String),
    });
    expect(typeof lease.token).toBe('string');

    expect(await storage.artifactStore.put(artifactInput('large-payload'))).toEqual({
      code: 'artifact-quarantined',
      health: 'ok',
      message: 'Artifact size exceeded the configured limit.',
    });
    expect(
      await storage.artifactStore.put(
        artifactInput('ok', {
          classification: 'blocked',
        }),
      ),
    ).toEqual({
      code: 'artifact-quarantined',
      health: 'ok',
      message: 'Artifact classification failed validation.',
    });
  });

  it('reopens streamed artifacts, tombstones, and scratch refs from persisted filesystem state', async () => {
    const backend = createFakeFilesystemBackend();
    const healthyStorage = openFilesystemStorage(createCommonOptions(backend));
    const streamedArtifact = await healthyStorage.artifactStore.put({
      ...artifactInput('streamed-artifact', {
        expiry: new Date('2026-06-23T00:00:00.000Z'),
      }),
      content: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(encodeBytes('streamed-'));
          controller.enqueue(encodeBytes('artifact'));
          controller.close();
        },
      }),
    });

    expect(
      await healthyStorage.artifactStore.put(
        artifactInput('streamed-artifact', {
          expiry: new Date('2026-06-23T00:00:00.000Z'),
        }),
      ),
    ).toEqual(streamedArtifact);
    expect(
      await healthyStorage.artifactStore.put(
        artifactInput('streamed-artifact', {
          expiry: new Date('2026-06-24T00:00:00.000Z'),
        }),
      ),
    ).toEqual({
      code: 'artifact-quarantined',
      health: 'ok',
      message: `Artifact ${streamedArtifact.id} failed metadata validation.`,
    });

    const redacted = healthyStorage.artifactStore.redact(streamedArtifact, 'mask-all');
    const reopenedHealthy = openFilesystemStorage(createCommonOptions(backend));

    expect(reopenedHealthy.artifactStore.resolve(redacted.id)).toEqual(redacted);
    expect(reopenedHealthy.debug.readTombstones()).toHaveLength(1);

    const degradedBackend = createFakeFilesystemBackend();
    const degradedStorage = openFilesystemStorage({
      ...createCommonOptions(degradedBackend),
      backend: createFaultInjectingFilesystemBackend({
        backend: degradedBackend,
        faults: [{ operation: 'fsync-directory', pathIncludes: '/.probes', times: 1 }],
      }),
    });
    const scratch = await degradedStorage.artifactStore.putScratch(artifactInput('persisted-scratch'));

    const reopenedDegraded = openFilesystemStorage({
      ...createCommonOptions(degradedBackend),
      backend: createFaultInjectingFilesystemBackend({
        backend: degradedBackend,
        faults: [{ operation: 'fsync-directory', pathIncludes: '/.probes', times: 1 }],
      }),
    });

    expect(await reopenedDegraded.artifactStore.putScratch(artifactInput('persisted-scratch'))).toEqual(scratch);
  });

  it('covers degraded authoritative refusals for append open renew release redact and export', () => {
    const degraded = openFilesystemStorage({
      ...createCommonOptions(createFakeFilesystemBackend()),
      backend: createFaultInjectingFilesystemBackend({
        backend: createFakeFilesystemBackend(),
        faults: [{ operation: 'fsync-directory', pathIncludes: '/.probes', times: 1 }],
      }),
    });

    expect(
      degraded.eventLogStore.openForAppend('blocked-log', {
        name: 'run-writer:blocked',
        epoch: 1,
        token: 'blocked-token',
      }),
    ).toEqual({
      code: 'network-fs-degraded',
      health: 'network-fs-degraded',
      message: 'Authoritative append is unavailable while storage health is network-fs-degraded.',
    });
    expect(
      degraded.eventLogStore.append(
        {
          logId: 'blocked-log',
          leaseName: 'run-writer:blocked',
          epoch: 1,
          token: 'blocked-token',
        },
        {
          expectedSequence: 1,
          durability: 'durable',
          payloads: [encodeBytes('blocked')],
        },
      ),
    ).toEqual({
      code: 'network-fs-degraded',
      health: 'network-fs-degraded',
      message: 'Authoritative append is unavailable while storage health is network-fs-degraded.',
    });
    expect(degraded.leaseStore.renew('blocked', 1, 'token', 1_000)).toEqual({
      code: 'network-fs-degraded',
      health: 'network-fs-degraded',
      message: 'Authoritative lease is unavailable while storage health is network-fs-degraded.',
    });
    expect(degraded.leaseStore.release('blocked', 1, 'token')).toEqual({
      code: 'network-fs-degraded',
      health: 'network-fs-degraded',
      message: 'Authoritative lease is unavailable while storage health is network-fs-degraded.',
    });
    expect(
      degraded.artifactStore.redact(
        {
          id: 'artifact:sha256:missing',
          digest: 'missing',
          size: 0,
          mediaType: 'text/plain',
          retentionClass: 'evidence',
          classification: 'internal',
          redactionState: 'raw',
        },
        'mask-all',
      ),
    ).toEqual({
      code: 'network-fs-degraded',
      health: 'network-fs-degraded',
      message: 'Authoritative evidence-ref is unavailable while storage health is network-fs-degraded.',
    });
    expect(
      degraded.artifactStore.export({
        artifactIds: [],
      }),
    ).toEqual({
      code: 'network-fs-degraded',
      health: 'network-fs-degraded',
      message: 'Authoritative export is unavailable while storage health is network-fs-degraded.',
    });
  });

  it('covers live, expired, faulted, and corrupted persisted log and lease branches', () => {
    const backend = createFakeFilesystemBackend();
    let nowValue = new Date('2026-06-22T00:00:00.000Z');
    const storage = openFilesystemStorage({
      ...createCommonOptions(backend),
      now: () => nowValue,
    });

    const logHandle = storage.eventLogStore.openForAppend('reopen-log', {
      name: 'run-writer:alpha',
      epoch: 1,
      token: 'lease-token-1',
    });
    expect(
      storage.eventLogStore.openForAppend('reopen-log', {
        name: 'run-writer:alpha',
        epoch: 1,
        token: 'lease-token-1',
      }),
    ).toEqual(logHandle);
    storage.eventLogStore.append(logHandle, {
      expectedSequence: 1,
      durability: 'durable',
      payloads: [encodeBytes('persisted-log')],
    });

    const persistedLog = parseJson<{ committed: Array<unknown>; interiorCorrupt: boolean }>(
      backend.readFile('/logs/reopen-log.json'),
    );
    backend.writeFile(
      '/logs/reopen-log.json',
      encodeJson({
        ...persistedLog,
        interiorCorrupt: true,
      }),
    );

    const liveLease = storage.leaseStore.acquire('run-writer:lease', 'holder', 1_000);
    expect(storage.leaseStore.read('run-writer:lease')).toMatchObject({
      snapshot: {
        name: 'run-writer:lease',
        epoch: 1,
        holder: 'holder',
      },
      health: 'ok',
    });

    nowValue = new Date('2026-06-22T00:00:10.000Z');
    const reopened = openFilesystemStorage({
      ...createCommonOptions(backend),
      now: () => nowValue,
    });

    expect(reopened.eventLogStore.replay('reopen-log').health).toBe('log-interior-corrupt');
    expect(
      reopened.eventLogStore.append(
        {
          logId: 'reopen-log',
          leaseName: 'run-writer:alpha',
          epoch: 1,
          token: 'lease-token-1',
        },
        {
          expectedSequence: 2,
          durability: 'durable',
          payloads: [encodeBytes('blocked-corrupt')],
        },
      ),
    ).toEqual({
      code: 'log-interior-corrupt',
      health: 'log-interior-corrupt',
      message: 'Committed history is incoherent for log reopen-log; append is read-only.',
    });
    expect(reopened.leaseStore.read('run-writer:lease')).toEqual({ health: 'ok' });
    expect(reopened.leaseStore.fence(liveLease.name, liveLease.epoch, liveLease.token)).toBe(false);
    expect(reopened.leaseStore.renew(liveLease.name, liveLease.epoch, liveLease.token, 1_000)).toEqual({
      code: 'stale-writer-fenced',
      health: 'ok',
      message: 'Lease renew was fenced because the supplied epoch or token is stale.',
    });
    expect(reopened.leaseStore.acquire('run-writer:lease', 'holder-2', 1_000)).toMatchObject({
      epoch: 2,
    });

    const renewBackend = createFakeFilesystemBackend();
    const renewStorage = openFilesystemStorage(createCommonOptions(renewBackend));
    const renewable = renewStorage.leaseStore.acquire('run-writer:renew', 'holder', 1_000);
    const renewFaulted = openFilesystemStorage({
      ...createCommonOptions(renewBackend),
      backend: createFaultInjectingFilesystemBackend({
        backend: renewBackend,
        faults: [{ operation: 'rename', pathIncludes: '/leases/', times: 1, afterProbePhase: true }],
      }),
    });
    expect(renewFaulted.leaseStore.renew(renewable.name, renewable.epoch, renewable.token, 1_000)).toEqual({
      code: 'lease-unavailable',
      health: 'network-fs-degraded',
      message: 'Lease acquire could not prove the guarded update.',
    });

    const releaseBackend = createFakeFilesystemBackend();
    const releaseStorage = openFilesystemStorage(createCommonOptions(releaseBackend));
    const releasable = releaseStorage.leaseStore.acquire('run-writer:release', 'holder', 1_000);
    const releaseFaulted = openFilesystemStorage({
      ...createCommonOptions(releaseBackend),
      backend: createFaultInjectingFilesystemBackend({
        backend: releaseBackend,
        faults: [{ operation: 'rename', pathIncludes: '/leases/', times: 1, afterProbePhase: true }],
      }),
    });
    expect(releaseFaulted.leaseStore.release(releasable.name, releasable.epoch, releasable.token)).toEqual({
      code: 'lease-unavailable',
      health: 'network-fs-degraded',
      message: 'Lease acquire could not prove the guarded update.',
    });
  });

  it('covers artifact integrity, reuse, and tombstone edge branches', async () => {
    const backend = createFakeFilesystemBackend();
    const storage = openFilesystemStorage({
      ...createCommonOptions(backend),
      classificationPolicy: (classification) => classification !== 'blocked',
    });

    const artifact = await storage.artifactStore.put(artifactInput('artifact-edge'));
    expect(storage.artifactStore.resolve(artifact.id)).toEqual(artifact);

    backend.corruptFile(`/artifacts/blobs/${artifact.digest}.bin`, encodeBytes('broken'));
    expect(storage.artifactStore.get(artifact, 'redacted')).toEqual({
      code: 'artifact-quarantined',
      health: 'ok',
      message: `Artifact ${artifact.id} failed digest verification.`,
    });
    expect(await storage.artifactStore.put(artifactInput('artifact-edge'))).toEqual({
      code: 'artifact-quarantined',
      health: 'ok',
      message: `Artifact ${artifact.id} failed digest verification.`,
    });
    expect(storage.artifactStore.redact(artifact, 'mask-all')).toEqual({
      code: 'artifact-quarantined',
      health: 'ok',
      message: `Artifact ${artifact.id} failed digest verification.`,
    });

    const seededBackend = createFakeFilesystemBackend();
    const seededBytes = encodeBytes('seeded-blob');
    seededBackend.ensureDirectory('/artifacts/blobs');
    seededBackend.writeFile(`/artifacts/blobs/${digestBytes(seededBytes)}.bin`, seededBytes);
    const seededStorage = openFilesystemStorage({
      ...createCommonOptions(seededBackend),
      classificationPolicy: (classification) => classification !== 'blocked',
    });
    const seededArtifact = await seededStorage.artifactStore.put(artifactInput('seeded-blob'));
    expect(seededArtifact).toMatchObject({
      id: createArtifactId(digestBytes(seededBytes)),
    });
    expect(seededStorage.debug.listFiles('/artifacts/blobs')).toContain(
      `/artifacts/blobs/${seededArtifact.digest}.bin`,
    );

    const hookBackend = createFakeFilesystemBackend();
    const hookStorage = openFilesystemStorage({
      ...createCommonOptions(hookBackend),
      classificationPolicy: (classification) => classification !== 'blocked',
    });
    const hookArtifact = await hookStorage.artifactStore.put(artifactInput('hook-artifact'));
    expect(hookStorage.artifactStore.redact(hookArtifact, 'blocked-classification')).toEqual({
      code: 'artifact-quarantined',
      health: 'ok',
      message: 'Artifact classification failed validation.',
    });
    expect(hookStorage.artifactStore.redact(hookArtifact, 'same-id')).toEqual({
      code: 'artifact-quarantined',
      health: 'ok',
      message: 'Redaction hook same-id did not produce a new artifact.',
    });
    hookBackend.remove(`/artifacts/blobs/${hookArtifact.digest}.bin`);
    expect(hookStorage.artifactStore.get(hookArtifact, 'raw')).toEqual({
      code: 'artifact-quarantined',
      health: 'ok',
      message: `Artifact ${hookArtifact.id} failed digest verification.`,
    });
    expect(hookStorage.artifactStore.redact(hookArtifact, 'mask-all')).toEqual({
      code: 'artifact-quarantined',
      health: 'ok',
      message: `Artifact ${hookArtifact.id} failed digest verification.`,
    });

    const tombstoneBackend = createFakeFilesystemBackend();
    const tombstoneStorage = openFilesystemStorage(createCommonOptions(tombstoneBackend));
    const original = await tombstoneStorage.artifactStore.put(artifactInput('tombstone-original'));
    const replacement = tombstoneStorage.artifactStore.redact(original, 'mask-all');
    const metadataPath = `/artifacts/meta/${encodeURIComponent(original.id)}.json`;
    const originalMetadata = parseJson<{
      metadata: Record<string, unknown>;
      originalDigest: string;
      replacementId?: string;
    }>(tombstoneBackend.readFile(metadataPath));

    tombstoneBackend.writeFile(
      metadataPath,
      encodeJson({
        ...originalMetadata,
        replacementId: undefined,
      }),
    );
    const missingReplacement = openFilesystemStorage(createCommonOptions(tombstoneBackend));
    expect(missingReplacement.artifactStore.export({ artifactIds: [original.id] })).toEqual({
      code: 'export-incomplete-forbidden',
      health: 'ok',
      message: `Artifact ${original.id} could not be verified for export.`,
    });

    tombstoneBackend.writeFile(
      metadataPath,
      encodeJson({
        ...originalMetadata,
        replacementId: `${replacement.id}-missing`,
      }),
    );
    const danglingReplacement = openFilesystemStorage(createCommonOptions(tombstoneBackend));
    expect(danglingReplacement.artifactStore.export({ artifactIds: [original.id] })).toEqual({
      code: 'export-incomplete-forbidden',
      health: 'ok',
      message: `Artifact ${original.id} could not be verified for export.`,
    });

    danglingReplacement.debug.corruptArtifact('artifact:sha256:not-found', encodeBytes('noop'));
    expect(danglingReplacement.debug.readTombstones()).toHaveLength(1);
  });

  it('covers relative backend paths, default fault counts, and sorted export ranges', () => {
    const backend = createFakeFilesystemBackend();

    backend.writeFile('relative.txt', encodeBytes('relative'));
    expect(backend.exists('relative.txt')).toBe(true);
    expect(textDecoder.decode(backend.readFile('relative.txt') as Uint8Array)).toBe('relative');

    const duplicateBaseBackend = createFakeFilesystemBackend();
    const duplicateFriendlyBackend = {
      ...duplicateBaseBackend,
      writeExclusive(path: string, bytes: Uint8Array) {
        duplicateBaseBackend.writeFile(path, bytes);
      },
    };
    const duplicateProbeStorage = openFilesystemStorage({
      ...createCommonOptions(createFakeFilesystemBackend()),
      backend: duplicateFriendlyBackend,
    });
    expect(duplicateProbeStorage.getProbeResults()).toContainEqual({ probe: 'exclusive-create', ok: false });

    const baseBackend = createFakeFilesystemBackend();
    const faultedStorage = openFilesystemStorage({
      ...createCommonOptions(baseBackend),
      backend: createFaultInjectingFilesystemBackend({
        backend: baseBackend,
        faults: [{ operation: 'write-file', pathIncludes: '/logs/' }],
      }),
    });
    const handle = faultedStorage.eventLogStore.openForAppend('fault-count-log', {
      name: 'run-writer:fault',
      epoch: 1,
      token: 'lease-token-fault',
    });
    expect(
      faultedStorage.eventLogStore.append(handle, {
        expectedSequence: 1,
        durability: 'durable',
        payloads: [encodeBytes('fault-once')],
      }),
    ).toEqual({
      code: 'network-fs-degraded',
      health: 'network-fs-degraded',
      message: 'Authoritative append is unavailable while storage health is network-fs-degraded.',
    });

    const sortedBackend = createFakeFilesystemBackend();
    const sortedStorage = openFilesystemStorage(createCommonOptions(sortedBackend));
    const logA = sortedStorage.eventLogStore.openForAppend('b-log', {
      name: 'run-writer:alpha',
      epoch: 1,
      token: 'lease-token-1',
    });
    sortedStorage.eventLogStore.append(logA, {
      expectedSequence: 1,
      durability: 'durable',
      payloads: [encodeBytes('b-log-record')],
    });
    const logB = sortedStorage.eventLogStore.openForAppend('a-log', {
      name: 'run-writer:alpha',
      epoch: 1,
      token: 'lease-token-1',
    });
    sortedStorage.eventLogStore.append(logB, {
      expectedSequence: 1,
      durability: 'durable',
      payloads: [encodeBytes('a-log-record')],
    });
    const exportManifest = sortedStorage.artifactStore.export({
      artifactIds: [],
      logRanges: [
        { logId: 'b-log', fromSequence: 1, toSequence: 1 },
        { logId: 'a-log', fromSequence: 1, toSequence: 1 },
      ],
    });

    expect(exportManifest.logRanges.map((range) => range.logId)).toEqual(['a-log', 'b-log']);
  });

  it('keeps local conformance hermetic by proving process and network calls are blocked in the lane', async () => {
    const childProcess = (await import('node:child_' + 'process')) as { execSync: (command: string) => Buffer };
    const http = (await import('node:' + 'http')) as { request: (url: string) => unknown };

    expect(() => childProcess.execSync('true')).toThrow(/forbidden/);
    expect(() => http.request('http://127.0.0.1')).toThrow(/forbidden/);
    expect(() => fetch('https://example.com')).toThrow(/forbidden/);
  });
});
