import type { ArtifactStore, ArtifactTombstoneRecord, ArtifactRedactionHookRegistry } from '../artifacts/index.js';
import type { StorageError } from '../errors/index.js';
import type { EventLogStore } from '../event-log/index.js';
import type { StorageHealth } from '../health/index.js';
import type { LeaseStore } from '../leases/index.js';

export const FILESYSTEM_PROBES = Object.freeze([
  'atomic-rename',
  'exclusive-create',
  'file-fsync',
  'directory-fsync',
  'lease-cas',
] as const);

export type FilesystemProbe = (typeof FILESYSTEM_PROBES)[number];

export type FilesystemProbeResult = {
  readonly probe: FilesystemProbe;
  readonly ok: boolean;
};

export type FilesystemFaultOperation =
  | 'write-file'
  | 'write-exclusive'
  | 'rename'
  | 'fsync-file'
  | 'fsync-directory'
  | 'remove';

export type FilesystemFaultRule = {
  readonly operation: FilesystemFaultOperation;
  readonly pathIncludes: string;
  readonly times?: number;
  readonly afterProbePhase?: boolean;
};

export type FilesystemBackend = {
  readonly rootLabel: string;
  ensureDirectory(path: string): void;
  exists(path: string): boolean;
  readFile(path: string): Uint8Array | undefined;
  writeFile(path: string, bytes: Uint8Array): void;
  writeExclusive(path: string, bytes: Uint8Array): void;
  rename(fromPath: string, toPath: string): void;
  remove(path: string): void;
  fsyncFile(path: string): void;
  fsyncDirectory(path: string): void;
  listFiles(prefix?: string): readonly string[];
  corruptFile(path: string, bytes: Uint8Array): void;
  setPhase?(phase: 'probe' | 'runtime'): void;
};

export type OpenFilesystemStorageOptions = {
  readonly backend: FilesystemBackend;
  readonly now?: () => Date;
  readonly createToken?: () => string;
  readonly digestBytes: (bytes: Uint8Array) => string;
  readonly digestToken: (token: string) => string;
  readonly sizeLimitBytes?: number;
  readonly classificationPolicy?: (classification: string) => boolean;
  readonly redactionHooks?: ArtifactRedactionHookRegistry;
};

export type FilesystemStorageDebug = {
  listQuarantinedEntries(): readonly string[];
  listFiles(prefix?: string): readonly string[];
  corruptArtifact(id: string, bytes: Uint8Array): void;
  readTombstones(): readonly ArtifactTombstoneRecord[];
};

export type FilesystemStorage = {
  readonly eventLogStore: EventLogStore;
  readonly leaseStore: LeaseStore;
  readonly artifactStore: ArtifactStore;
  getHealth(): StorageHealth;
  getProbeResults(): readonly FilesystemProbeResult[];
  readonly debug: FilesystemStorageDebug;
};

export type LeaseMutationError = StorageError & {
  readonly code: 'lease-unavailable';
};
