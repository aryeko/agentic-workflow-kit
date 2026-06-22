import type { ExportManifest } from '../artifacts/index.js';

export type EvidenceBundleManifest = {
  readonly manifestVersion: '1';
  readonly exportManifest: ExportManifest;
  readonly artifactCount: number;
  readonly stableArtifactIds: readonly string[];
  readonly digests: readonly string[];
};

export const createEvidenceBundleManifest = (exportManifest: ExportManifest): EvidenceBundleManifest => ({
  manifestVersion: '1',
  exportManifest,
  artifactCount: exportManifest.artifacts.length,
  stableArtifactIds: exportManifest.artifacts.map((artifact) => artifact.id),
  digests: exportManifest.artifacts.map((artifact) => artifact.digest),
});
