import { existsSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { FileSystemArtifactStore } from './artifact-store.js';
import { FileSystemEventLogStore } from './event-log-store.js';
import {
  ensureStorageDirectories,
  fsyncDirectory,
  fsyncFile,
  leaseFilePath,
  leaseGuardPath,
  makeStoragePaths,
  removeIfExists,
  type StoragePaths,
} from './fs-utils.js';
import { FileSystemLeaseStore } from './lease-store.js';
import { StorageRootState } from './state.js';
import { isStorageError, type FileSystemStorageRootOptions, type StorageHealth, type StorageRoot } from './types.js';

export const createFileSystemStorageRoot = (options: FileSystemStorageRootOptions): StorageRoot => {
  const paths = makeStoragePaths(options.root);
  ensureStorageDirectories(paths);
  const initialHealth = options.probe?.() ?? probeStorageRoot(paths, options);
  const state = new StorageRootState(initialHealth);
  const leases = new FileSystemLeaseStore(paths, state, options);
  const eventLog = new FileSystemEventLogStore(paths, state, leases, options);
  const artifacts = new FileSystemArtifactStore(paths, state, eventLog, options);

  return {
    get health() {
      return state.health;
    },
    eventLog,
    leases,
    artifacts,
  };
};

const probeStorageRoot = (paths: StoragePaths, options: FileSystemStorageRootOptions): StorageHealth => {
  const probeId = options.idGenerator.nextId('storage-probe');
  const source = join(paths.root, `.probe-${probeId}.tmp`);
  const destination = join(paths.root, `.probe-${probeId}.renamed`);
  const exclusive = join(paths.root, `.probe-${probeId}.exclusive`);
  try {
    writeFileSync(source, 'probe');
    fsyncFile(source, options.durabilityObserver);
    renameSync(source, destination);
    fsyncDirectory(paths.root, options.durabilityObserver);
    writeFileSync(exclusive, 'exclusive', { flag: 'wx' });
    fsyncFile(exclusive, options.durabilityObserver);
    fsyncDirectory(paths.root, options.durabilityObserver);
    if (!existsSync(destination) || !existsSync(exclusive)) {
      return 'network-fs-degraded';
    }
    return probeLeaseCas(paths, options, probeId);
  } catch {
    return 'network-fs-degraded';
  } finally {
    removeIfExists(source);
    removeIfExists(destination);
    removeIfExists(exclusive);
    try {
      fsyncDirectory(paths.root, options.durabilityObserver);
    } catch {
      // Probe cleanup best effort; the failed proof has already degraded health.
    }
    try {
      unlinkSync(source);
    } catch {
      // Best effort cleanup for paths already removed.
    }
  }
};

const probeLeaseCas = (paths: StoragePaths, options: FileSystemStorageRootOptions, probeId: string): StorageHealth => {
  const state = new StorageRootState('ok');
  const leases = new FileSystemLeaseStore(paths, state, options);
  const leaseName = `storage-probe:${probeId}`;
  let health: StorageHealth = 'ok';

  try {
    const acquired = leases.acquire(leaseName, 'storage-probe', 60_000);
    if (isStorageError(acquired)) {
      health = state.health === 'ok' ? 'network-fs-degraded' : state.health;
    } else {
      const blocked = leases.acquire(leaseName, 'storage-probe-contender', 60_000);
      if (!isStorageError(blocked)) {
        health = 'network-fs-degraded';
      }

      const renewed = leases.renew(leaseName, acquired.epoch, acquired.token, 60_000);
      if (isStorageError(renewed)) {
        health = state.health === 'ok' ? 'network-fs-degraded' : state.health;
      }

      const released = leases.release(leaseName, acquired.epoch, acquired.token);
      if (isStorageError(released)) {
        health = state.health === 'ok' ? 'network-fs-degraded' : state.health;
      }
    }
  } catch {
    health = 'network-fs-degraded';
  }

  try {
    removeIfExists(leaseFilePath(paths, leaseName));
    removeIfExists(leaseGuardPath(paths, leaseName));
    fsyncDirectory(paths.leases, options.durabilityObserver);
  } catch {
    health = 'network-fs-degraded';
  }

  return health;
};
