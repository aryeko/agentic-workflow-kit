import type {
  ArtifactInput,
  ArtifactRedactionState,
  ArtifactRef,
  ExportManifest,
  ScratchArtifactRef,
} from './artifact-types.js';

export type ArtifactMetadataRecord = {
  readonly id: string;
  readonly digest: string;
  readonly size: number;
  readonly mediaType: string;
  readonly retentionClass: string;
  readonly classification: string;
  readonly producer: string;
  readonly redactionState: ArtifactRedactionState;
  readonly createdAt: Date;
  readonly expiry?: Date;
  readonly authoritative: boolean;
};

export type ArtifactTombstoneRecord = {
  readonly originalId: string;
  readonly originalDigest: string;
  readonly replacementId: string;
  readonly replacementDigest: string;
  readonly hookId: string;
  readonly createdAt: Date;
};

export type ArtifactReference = ArtifactRef | ScratchArtifactRef;

export const isScratchArtifactRef = (reference: ArtifactReference): reference is ScratchArtifactRef =>
  reference.id.startsWith('scratch:sha256:');

export const isArtifactRefEvidenceEligible = (reference: ArtifactReference): reference is ArtifactRef =>
  !isScratchArtifactRef(reference);

export const isArtifactRefRetentionEligible = (reference: ArtifactReference): reference is ArtifactRef =>
  !isScratchArtifactRef(reference);

export const toArtifactMetadataRecord = (
  ref: ArtifactRef | ScratchArtifactRef,
  input: ArtifactInput,
  digest: string,
  size: number,
  createdAt: Date,
  redactionState: ArtifactRedactionState,
  authoritative: boolean,
): ArtifactMetadataRecord => ({
  id: ref.id,
  digest,
  size,
  mediaType: ref.mediaType,
  retentionClass: 'retentionClass' in ref ? ref.retentionClass : input.retentionClass,
  classification: ref.classification,
  producer: input.producer,
  redactionState,
  createdAt,
  expiry: input.expiry,
  authoritative,
});

export const createArtifactId = (digest: string): string => `artifact:sha256:${digest}`;

export const createScratchArtifactId = (digest: string): string => `scratch:sha256:${digest}`;

export const createArtifactRef = (record: ArtifactMetadataRecord): ArtifactRef => ({
  id: record.id,
  digest: record.digest,
  size: record.size,
  mediaType: record.mediaType,
  retentionClass: record.retentionClass,
  classification: record.classification,
  redactionState: record.redactionState,
});

export const createScratchArtifactRef = (record: ArtifactMetadataRecord): ScratchArtifactRef => ({
  id: record.id,
  digest: record.digest,
  size: record.size,
  mediaType: record.mediaType,
  classification: record.classification,
  redactionState: record.redactionState === 'tombstoned' ? 'redacted' : record.redactionState,
});

export const createArtifactTombstoneRecord = (
  original: ArtifactRef,
  replacement: ArtifactRef,
  hookId: string,
  createdAt: Date,
): ArtifactTombstoneRecord => ({
  originalId: original.id,
  originalDigest: original.digest,
  replacementId: replacement.id,
  replacementDigest: replacement.digest,
  hookId,
  createdAt,
});

export const isExportManifestRedactedByDefault = (manifest: ExportManifest): boolean =>
  manifest.redactionMode === 'redacted';
