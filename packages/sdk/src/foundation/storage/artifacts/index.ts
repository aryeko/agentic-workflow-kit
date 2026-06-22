export {
  collectArtifactStreamBytes,
  createInMemoryArtifactStore,
  type CreateInMemoryArtifactStoreOptions,
  type InMemoryArtifactStore,
} from './artifact-store.js';
export {
  createArtifactId,
  createArtifactRef,
  createArtifactTombstoneRecord,
  createScratchArtifactId,
  createScratchArtifactRef,
  isArtifactRefEvidenceEligible,
  isArtifactRefRetentionEligible,
  isExportManifestRedactedByDefault,
  isScratchArtifactRef,
  toArtifactMetadataRecord,
  type ArtifactMetadataRecord,
  type ArtifactReference,
  type ArtifactTombstoneRecord,
} from './artifact-evidence.js';
export type {
  ArtifactInput,
  ArtifactRedactionState,
  ArtifactRef,
  ArtifactStore,
  ArtifactStream,
  ExportLogRangeSelection,
  ExportManifest,
  ExportManifestArtifact,
  ExportManifestLogRange,
  ExportSelection,
  ScratchArtifactRef,
} from './artifact-types.js';
export type {
  ArtifactRedactionHook,
  ArtifactRedactionHookContext,
  ArtifactRedactionHookRegistry,
  ArtifactRedactionHookResult,
} from './redaction-hooks.js';
