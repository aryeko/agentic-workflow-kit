import type { StorageError } from '../errors/index.js';
import type { StorageHealth } from '../health/index.js';

export type ArtifactRedactionState = 'raw' | 'redacted' | 'tombstoned';

export type ArtifactRef = {
  readonly id: string;
  readonly digest: string;
  readonly size: number;
  readonly mediaType: string;
  readonly retentionClass: string;
  readonly classification: string;
  readonly redactionState: ArtifactRedactionState;
};

export type ScratchArtifactRef = {
  readonly id: string;
  readonly digest: string;
  readonly size: number;
  readonly mediaType: string;
  readonly classification: string;
  readonly redactionState: Exclude<ArtifactRedactionState, 'tombstoned'>;
};

export type ArtifactInput = {
  readonly content: ReadableStream<Uint8Array> | Uint8Array;
  readonly mediaType: string;
  readonly retentionClass: string;
  readonly classification: string;
  readonly expiry?: Date;
  readonly producer: string;
};

export type ArtifactStream = {
  readonly ref: ArtifactRef;
  readonly bytes: ReadableStream<Uint8Array>;
};

export type ExportLogRangeSelection = {
  readonly logId: string;
  readonly fromSequence: number;
  readonly toSequence: number;
};

export type ExportSelection = {
  readonly artifactIds: readonly string[];
  readonly logRanges?: readonly ExportLogRangeSelection[];
  readonly mode?: 'redacted' | 'raw';
};

export type ExportManifestArtifact = {
  readonly id: string;
  readonly digest: string;
  readonly size: number;
  readonly redactionState: ArtifactRedactionState;
};

export type ExportManifestLogRange = ExportLogRangeSelection & {
  readonly frameDigest: string;
};

export type ExportManifest = {
  readonly createdAt: Date;
  readonly redactionMode: 'redacted' | 'raw';
  readonly logHealth: StorageHealth;
  readonly artifacts: readonly ExportManifestArtifact[];
  readonly logRanges: readonly ExportManifestLogRange[];
};

export interface ArtifactStore {
  put(input: ArtifactInput): ArtifactRef | StorageError;
  putScratch(input: ArtifactInput): ScratchArtifactRef | StorageError;
  resolve(id: string): ArtifactRef | StorageError;
  get(ref: ArtifactRef, mode: 'redacted' | 'raw'): ArtifactStream | StorageError;
  redact(ref: ArtifactRef, hookId: string): ArtifactRef | StorageError;
  export(selection: ExportSelection): ExportManifest | StorageError;
}
