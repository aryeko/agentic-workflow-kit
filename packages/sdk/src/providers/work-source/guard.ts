import type { Claim, TaskKey, WorkSourceError } from './types.js';

const dependencyReasons = ['missing', 'malformed', 'blocked', 'unknown', 'incomplete'] as const;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

const isTaskKey = (value: unknown): value is TaskKey =>
  isPlainObject(value) &&
  isNonEmptyString(value.workSourceId) &&
  isNonEmptyString(value.trackId) &&
  isNonEmptyString(value.taskId);

const isClaim = (value: unknown): value is Claim =>
  isPlainObject(value) &&
  isNonEmptyString(value.runId) &&
  isNonEmptyString(value.holder) &&
  isNonEmptyString(value.claimedAt) &&
  isNonEmptyString(value.expiresAt) &&
  typeof value.epoch === 'number';

export const isWorkSourceError = (input: unknown): input is WorkSourceError => {
  if (!isPlainObject(input) || !isNonEmptyString(input.kind)) {
    return false;
  }

  switch (input.kind) {
    case 'work-source-unavailable':
      return isNonEmptyString(input.message) && (input.sourceRef === undefined || isNonEmptyString(input.sourceRef));
    case 'track-malformed':
      return isNonEmptyString(input.trackId) && isNonEmptyString(input.diagnostic);
    case 'dependency-unresolved':
      return (
        isTaskKey(input.task) &&
        isTaskKey(input.dependency) &&
        dependencyReasons.includes(input.reason as (typeof dependencyReasons)[number])
      );
    case 'status-bucket-unknown':
      return isTaskKey(input.task) && isNonEmptyString(input.nativeStatus);
    case 'claim-conflict':
      return (
        isTaskKey(input.task) &&
        isNonEmptyString(input.expectedRecordDigest) &&
        isNonEmptyString(input.observedRecordDigest) &&
        (input.expectedEpoch === undefined || typeof input.expectedEpoch === 'number') &&
        (input.observedEpoch === undefined || typeof input.observedEpoch === 'number')
      );
    case 'claim-lock-unavailable':
      return (
        isTaskKey(input.task) &&
        isNonEmptyString(input.leaseKey) &&
        (input.priorClaim === undefined || isClaim(input.priorClaim))
      );
    case 'snapshot-artifact-unavailable':
    case 'status-write-unavailable':
      return isTaskKey(input.task) && isNonEmptyString(input.diagnostic);
    case 'status-authority-conflict':
      return (
        isTaskKey(input.task) &&
        isNonEmptyString(input.observedRecordDigest) &&
        (input.expectedRecordDigest === undefined || isNonEmptyString(input.expectedRecordDigest))
      );
    default:
      return false;
  }
};
