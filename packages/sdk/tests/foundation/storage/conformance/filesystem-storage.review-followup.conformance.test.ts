import { describe, expect, it } from 'vitest';

import type { FilesystemBackend, OpenFilesystemStorageOptions } from '../../../../src/index.js';
import { createFakeFilesystemBackend, openFilesystemStorage } from '../../../../src/index.js';
import {
  artifactInput,
  digestBytes,
  digestToken,
  encodeBytes,
} from '../../../fixtures/storage/filesystem-fixture-helpers.ts';

const createCommonOptions = (backend: FilesystemBackend): OpenFilesystemStorageOptions => ({
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
  },
});

describe('filesystem storage review follow-up regressions', () => {
  it('revalidates a lease after the exclusive guard is acquired before issuing a fresh capability', () => {
    const baseBackend = createFakeFilesystemBackend();
    const leaseName = 'run-writer:race';
    const leasePath = `/leases/${encodeURIComponent(leaseName)}.json`;
    const guardPath = `/leases/${encodeURIComponent(leaseName)}.guard.json`;

    let injectConcurrentWinner = true;
    const backend: FilesystemBackend = {
      ...baseBackend,
      writeExclusive(path, bytes) {
        baseBackend.writeExclusive(path, bytes);
        if (injectConcurrentWinner && path === guardPath) {
          injectConcurrentWinner = false;
          baseBackend.writeFile(
            leasePath,
            encodeBytes(
              JSON.stringify({
                name: leaseName,
                epoch: 7,
                holder: 'holder-b',
                tokenDigest: digestToken('token-b'),
                expiresAt: '2026-06-22T00:10:00.000Z',
              }),
            ),
          );
        }
      },
    };

    const storage = openFilesystemStorage(createCommonOptions(backend));

    expect(storage.leaseStore.acquire(leaseName, 'holder-a', 60_000)).toEqual({
      code: 'stale-writer-fenced',
      health: 'ok',
      message: 'Lease acquire was fenced because a live lease already exists.',
    });
    expect(storage.leaseStore.read(leaseName)).toMatchObject({
      snapshot: {
        name: leaseName,
        epoch: 7,
        holder: 'holder-b',
      },
      health: 'ok',
    });
  });

  it('revalidates renewals against the authoritative record after the exclusive guard is acquired', () => {
    const baseBackend = createFakeFilesystemBackend();
    const leaseName = 'run-writer:renew-race';
    const leasePath = `/leases/${encodeURIComponent(leaseName)}.json`;
    const guardPath = `/leases/${encodeURIComponent(leaseName)}.guard.json`;

    let hijackNextGuardWrite = false;
    const backend: FilesystemBackend = {
      ...baseBackend,
      writeExclusive(path, bytes) {
        baseBackend.writeExclusive(path, bytes);
        if (hijackNextGuardWrite && path === guardPath) {
          hijackNextGuardWrite = false;
          baseBackend.writeFile(
            leasePath,
            encodeBytes(
              JSON.stringify({
                name: leaseName,
                epoch: 2,
                holder: 'holder-b',
                tokenDigest: digestToken('token-b'),
                expiresAt: '2026-06-22T00:10:00.000Z',
              }),
            ),
          );
        }
      },
    };

    const storage = openFilesystemStorage(createCommonOptions(backend));
    const first = storage.leaseStore.acquire(leaseName, 'holder-a', 60_000);

    expect(first).toMatchObject({
      name: leaseName,
      epoch: 1,
      token: expect.any(String),
    });

    hijackNextGuardWrite = true;
    expect(storage.leaseStore.renew(leaseName, first.epoch, first.token, 60_000)).toEqual({
      code: 'stale-writer-fenced',
      health: 'ok',
      message: 'Lease renew was fenced because the supplied epoch or token is stale.',
    });
    expect(storage.leaseStore.read(leaseName)).toMatchObject({
      snapshot: {
        name: leaseName,
        epoch: 2,
        holder: 'holder-b',
      },
      health: 'ok',
    });
  });

  it('reclaims stale lease guards instead of degrading the storage health permanently', () => {
    const backend = createFakeFilesystemBackend();
    const leaseName = 'run-writer:stale-guard';
    const encodedName = encodeURIComponent(leaseName);

    backend.writeFile(
      `/leases/${encodedName}.guard.json`,
      encodeBytes(
        JSON.stringify({
          name: leaseName,
          guardExpiresAt: '2026-06-21T23:58:00.000Z',
        }),
      ),
    );

    const storage = openFilesystemStorage(createCommonOptions(backend));
    const acquired = storage.leaseStore.acquire(leaseName, 'holder-a', 60_000);

    expect(acquired).toMatchObject({
      name: leaseName,
      epoch: 1,
      token: expect.any(String),
    });
    expect(storage.getHealth()).toBe('ok');
    expect(backend.exists(`/leases/${encodedName}.guard.json`)).toBe(false);
  });

  it('applies scratch validation before persisting degraded artifacts', async () => {
    const oversizedBackend = createFakeFilesystemBackend();
    const oversizedStorage = openFilesystemStorage({
      ...createCommonOptions(oversizedBackend),
      backend: oversizedBackend,
      sizeLimitBytes: 4,
      now: () => new Date('2026-06-22T00:00:00.000Z'),
    });

    expect(await oversizedStorage.artifactStore.putScratch(artifactInput('oversized'))).toEqual({
      code: 'network-fs-degraded',
      health: 'ok',
      message: 'Scratch artifacts are available only while storage health is ok.',
    });

    const degradedBackend = createFakeFilesystemBackend();
    const degradedStorage = openFilesystemStorage({
      ...createCommonOptions(degradedBackend),
      backend: {
        ...degradedBackend,
        fsyncDirectory(path) {
          if (path.includes('/.probes')) {
            throw new Error('probe degradation');
          }
          degradedBackend.fsyncDirectory(path);
        },
      },
      sizeLimitBytes: 4,
      classificationPolicy: (classification) => classification !== 'blocked',
      now: () => new Date('2026-06-22T00:00:00.000Z'),
    });

    expect(degradedStorage.getHealth()).toBe('network-fs-degraded');
    expect(await degradedStorage.artifactStore.putScratch(artifactInput('oversized'))).toEqual({
      code: 'artifact-quarantined',
      health: 'network-fs-degraded',
      message: 'Artifact size exceeded the configured limit.',
    });
    expect(await degradedStorage.artifactStore.putScratch(artifactInput('bad', { classification: 'blocked' }))).toEqual(
      {
        code: 'artifact-quarantined',
        health: 'network-fs-degraded',
        message: 'Artifact classification failed validation.',
      },
    );
    expect(degradedStorage.debug.listFiles('/artifacts/scratch')).toEqual([]);
    expect(degradedStorage.debug.listFiles('/artifacts/scratch-meta')).toEqual([]);
  });
});
