import type {
  DuplicateLaunchBlockedPayload,
  RecoveryActionPlannedPayload,
  RecoveryClassifiedPayload,
  StoryLaunchLeaseAcquiredPayload,
} from './payloads.js';

export interface RecoveryProjection {
  readonly runId: string;
  readonly latestClassification?: RecoveryClassifiedPayload;
  readonly activeStoryLaunchLease?: StoryLaunchLeaseAcquiredPayload;
  readonly duplicateLaunch?: DuplicateLaunchBlockedPayload;
  readonly latestPlan?: RecoveryActionPlannedPayload;
  readonly parked: boolean;
}
