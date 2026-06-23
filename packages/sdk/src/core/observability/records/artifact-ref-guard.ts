import type { ArtifactRef } from '../../../foundation/storage/artifacts/index.js';
import { isScratchArtifactRef } from '../../../foundation/storage/artifacts/index.js';
import type { StorageError } from '../../../foundation/storage/index.js';

import type { AnalysisReportRefCandidate } from './types.js';

export const isStorageError = (value: unknown): value is StorageError =>
  typeof value === 'object' && value !== null && 'code' in value && 'health' in value && 'message' in value;

export const isRedactedWriteOnceArtifactRef = (candidate: AnalysisReportRefCandidate): candidate is ArtifactRef =>
  !isScratchArtifactRef(candidate) && candidate.redactionState === 'redacted';
