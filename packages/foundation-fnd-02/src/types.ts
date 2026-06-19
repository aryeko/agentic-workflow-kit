export type DurabilityClass = 'buffered' | 'durable' | 'barrier';

export type StorageHealth =
  | 'ok'
  | 'log-tail-repaired'
  | 'log-interior-corrupt'
  | 'network-fs-degraded'
  | 'read-only'
  | 'unusable';

export type StorageErrorCode =
  | 'storage-unavailable'
  | 'network-fs-degraded'
  | 'log-interior-corrupt'
  | 'sequence-conflict'
  | 'stale-writer-fenced'
  | 'lease-unavailable'
  | 'artifact-quarantined'
  | 'export-incomplete-forbidden'
  | 'not-found'
  | 'invalid-input';

export interface StorageError {
  readonly kind: 'storage-error';
  readonly code: StorageErrorCode;
  readonly message: string;
  readonly health: StorageHealth;
  readonly details?: Record<string, unknown>;
}

export const isStorageError = (value: unknown): value is StorageError =>
  typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'storage-error';

export interface StorageClock {
  now(): Date;
}

export interface IdGenerator {
  nextId(purpose: string): string;
}

export interface TokenGenerator {
  nextToken(purpose: string): string;
}

export interface LeaseCapability {
  readonly name: string;
  readonly epoch: number;
  readonly token: string;
  readonly expiresAt: Date;
}

export interface LeaseSnapshot {
  readonly name: string;
  readonly epoch: number;
  readonly holder: string;
  readonly tokenDigest: string;
  readonly expiresAt: Date;
}

export interface LeaseReadResult {
  readonly snapshot?: LeaseSnapshot;
  readonly health: StorageHealth;
}

export interface LeaseStore {
  acquire(name: string, holder: string, ttlMs: number): LeaseCapability | StorageError;
  renew(name: string, epoch: number, token: string, ttlMs: number): LeaseCapability | StorageError;
  release(name: string, epoch: number, token: string): undefined | StorageError;
  read(name: string): LeaseReadResult;
  fence(name: string, epoch: number, token: string): boolean;
}

export interface LogHandle {
  readonly logId: string;
  readonly leaseName: string;
  readonly epoch: number;
  readonly token: string;
}

export interface AppendBatch {
  readonly expectedSequence: number;
  readonly durability: DurabilityClass;
  readonly payloads: readonly Uint8Array[];
}

export interface StoredRecord {
  readonly sequence: number;
  readonly writerEpoch: number;
  readonly leaseName: string;
  readonly payload: Uint8Array;
  readonly payloadDigest: string;
  readonly frameDigest: string;
  readonly byteStart: number;
  readonly byteEnd: number;
}

export interface ReplayResult {
  readonly records: readonly StoredRecord[];
  readonly health: StorageHealth;
}

export interface AppendReceipt {
  readonly kind: 'append-receipt';
  readonly logId: string;
  readonly leaseName: string;
  readonly writerEpoch: number;
  readonly firstSequence: number;
  readonly lastSequence: number;
  readonly byteStart: number;
  readonly byteEnd: number;
  readonly recordCount: number;
  readonly batchDigest: string;
  readonly durability: Exclude<DurabilityClass, 'buffered'>;
  readonly health: StorageHealth;
}

export interface NonDurableAck {
  readonly kind: 'non-durable-ack';
  readonly logId: string;
  readonly leaseName: string;
  readonly writerEpoch: number;
  readonly firstSequence: number;
  readonly lastSequence: number;
  readonly recordCount: number;
  readonly durability: 'buffered';
  readonly health: StorageHealth;
}

export interface EventLogStore {
  openForAppend(logId: string, lease: LeaseCapability): LogHandle | StorageError;
  append(handle: LogHandle, batch: AppendBatch): AppendReceipt | NonDurableAck | StorageError;
  replay(logId: string): ReplayResult;
}

export interface ArtifactInput {
  readonly content: Uint8Array | string;
  readonly mediaType: string;
  readonly retentionClass: string;
  readonly classification: string;
  readonly producer?: string;
  readonly expiresAt?: Date;
  readonly redactionHookId?: string;
}

export interface ArtifactRef {
  readonly id: string;
  readonly digest: string;
  readonly size: number;
  readonly mediaType: string;
  readonly retentionClass: string;
  readonly classification: string;
  readonly redactionState: 'raw' | 'redacted' | 'tombstoned';
}

export interface ScratchArtifactRef {
  readonly id: string;
  readonly digest: string;
  readonly size: number;
  readonly mediaType: string;
  readonly classification: string;
  readonly redactionState: 'raw' | 'redacted';
}

export interface ArtifactBytes {
  readonly ref: ArtifactRef;
  readonly bytes: Uint8Array;
  readonly verifiedDigest: string;
}

export interface ExportSelection {
  readonly artifactIds?: readonly string[];
  readonly logIds?: readonly string[];
  readonly includeRawTombstoned?: boolean;
}

export interface ExportManifestArtifact {
  readonly id: string;
  readonly digest: string;
  readonly size: number;
  readonly mediaType: string;
  readonly retentionClass: string;
  readonly classification: string;
  readonly redactionState: 'raw' | 'redacted';
}

export interface ExportManifestLog {
  readonly logId: string;
  readonly health: StorageHealth;
  readonly firstSequence?: number;
  readonly lastSequence?: number;
  readonly recordCount: number;
}

export interface ExportManifest {
  readonly schema: 'kit-vnext.storage-export.v1';
  readonly id: string;
  readonly createdAt: string;
  readonly storageHealth: StorageHealth;
  readonly logs: readonly ExportManifestLog[];
  readonly artifacts: readonly ExportManifestArtifact[];
  readonly digest: string;
}

export interface ArtifactStore {
  put(input: ArtifactInput): ArtifactRef | StorageError;
  putScratch(input: ArtifactInput): ScratchArtifactRef | StorageError;
  resolve(id: string): ArtifactRef | StorageError;
  get(ref: ArtifactRef, mode: 'redacted' | 'raw'): ArtifactBytes | StorageError;
  redact(ref: ArtifactRef, hookId: string): ArtifactRef | StorageError;
  export(selection: ExportSelection): ExportManifest | StorageError;
}

export interface StorageRoot {
  readonly health: StorageHealth;
  readonly eventLog: EventLogStore;
  readonly leases: LeaseStore;
  readonly artifacts: ArtifactStore;
}

export interface FileSystemStorageRootOptions {
  readonly root: string;
  readonly clock: StorageClock;
  readonly idGenerator: IdGenerator;
  readonly tokenGenerator: TokenGenerator;
  readonly maxArtifactBytes?: number;
  readonly allowRawTombstoneAccess?: boolean;
  readonly redactionHooks?: ReadonlyMap<string, (content: Uint8Array, ref?: ArtifactRef) => Uint8Array>;
  readonly probe?: () => StorageHealth;
  readonly durabilityObserver?: (event: {
    readonly operation: 'fsync-file' | 'fsync-directory';
    readonly path: string;
  }) => void;
}
