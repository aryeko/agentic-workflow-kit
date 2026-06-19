import {
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { sha256Bytes } from './digest.js';
import type { FileSystemStorageRootOptions } from './types.js';

export interface StoragePaths {
  readonly root: string;
  readonly logs: string;
  readonly logQuarantine: string;
  readonly leases: string;
  readonly staleGuards: string;
  readonly artifactBlobs: string;
  readonly artifactMetadata: string;
  readonly artifactScratch: string;
  readonly artifactExports: string;
  readonly artifactTmp: string;
  readonly tombstones: string;
}

export const makeStoragePaths = (root: string): StoragePaths => ({
  root,
  logs: join(root, 'logs'),
  logQuarantine: join(root, 'logs', 'quarantine'),
  leases: join(root, 'leases'),
  staleGuards: join(root, 'leases', 'stale'),
  artifactBlobs: join(root, 'artifacts', 'blobs'),
  artifactMetadata: join(root, 'artifacts', 'metadata'),
  artifactScratch: join(root, 'artifacts', 'scratch'),
  artifactExports: join(root, 'artifacts', 'exports'),
  artifactTmp: join(root, 'artifacts', 'tmp'),
  tombstones: join(root, 'artifacts', 'tombstones.jsonl'),
});

export const ensureStorageDirectories = (paths: StoragePaths): void => {
  for (const directory of [
    paths.logs,
    paths.logQuarantine,
    paths.leases,
    paths.staleGuards,
    paths.artifactBlobs,
    paths.artifactMetadata,
    paths.artifactScratch,
    paths.artifactExports,
    paths.artifactTmp,
  ]) {
    mkdirSync(directory, { recursive: true });
  }
};

export const storageKey = (value: string): string => sha256Bytes(value);

export const logFilePath = (paths: StoragePaths, logId: string): string =>
  join(paths.logs, `${storageKey(logId)}.jsonl`);

export const logCorruptMarkerPath = (paths: StoragePaths, logId: string): string =>
  join(paths.logs, `${storageKey(logId)}.corrupt.json`);

export const leaseFilePath = (paths: StoragePaths, name: string): string =>
  join(paths.leases, `${storageKey(name)}.json`);

export const leaseGuardPath = (paths: StoragePaths, name: string): string =>
  join(paths.leases, `${storageKey(name)}.guard`);

export const blobPath = (paths: StoragePaths, digest: string): string =>
  join(paths.artifactBlobs, digest.slice(0, 2), digest);

export const metadataPath = (paths: StoragePaths, id: string): string =>
  join(paths.artifactMetadata, `${storageKey(id)}.json`);

export const fsyncFile = (
  path: string,
  observer: FileSystemStorageRootOptions['durabilityObserver'] | undefined,
): void => {
  const fd = openSync(path, 'r');
  try {
    fsyncSync(fd);
    observer?.({ operation: 'fsync-file', path });
  } finally {
    closeSync(fd);
  }
};

export const fsyncDirectory = (
  path: string,
  observer: FileSystemStorageRootOptions['durabilityObserver'] | undefined,
): void => {
  const fd = openSync(path, 'r');
  try {
    fsyncSync(fd);
    observer?.({ operation: 'fsync-directory', path });
  } finally {
    closeSync(fd);
  }
};

export const writeFileDurable = (
  path: string,
  content: string | Uint8Array,
  observer: FileSystemStorageRootOptions['durabilityObserver'] | undefined,
): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  fsyncFile(path, observer);
  fsyncDirectory(dirname(path), observer);
};

export const writeFileAtomicDurable = (
  path: string,
  content: string | Uint8Array,
  tempPath: string,
  observer: FileSystemStorageRootOptions['durabilityObserver'] | undefined,
): void => {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(tempPath, content);
  fsyncFile(tempPath, observer);
  renameSync(tempPath, path);
  fsyncDirectory(dirname(path), observer);
};

export const readTextIfExists = (path: string): string | undefined =>
  existsSync(path) ? readFileSync(path, 'utf8') : undefined;

export const removeIfExists = (path: string): void => {
  if (existsSync(path)) {
    unlinkSync(path);
  }
};

export const cleanPath = (path: string): void => {
  rmSync(path, { recursive: true, force: true });
};
