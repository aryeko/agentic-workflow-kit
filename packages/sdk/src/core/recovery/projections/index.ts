import type {
  DuplicateLaunchBlockedPayload,
  RecoveryActionPlannedPayload,
  RecoveryClassifiedPayload,
  RecoveryProjection,
  StoryLaunchLeaseAcquiredPayload,
  StoryLaunchLeaseClearedPayload,
} from '../contracts/index.js';
import type { RunEventEnvelope } from '../../run-lifecycle/contracts/index.js';

export const foldRecoveryProjection = (runId: string, events: readonly RunEventEnvelope[]): RecoveryProjection => {
  const sortedEvents = [...events].sort(
    (left, right) => left.sequence - right.sequence || left.eventId.localeCompare(right.eventId),
  );

  return sortedEvents.reduce<RecoveryProjection>((projection, event) => foldEvent(projection, event), {
    runId,
    parked: false,
  });
};

const foldEvent = (projection: RecoveryProjection, event: RunEventEnvelope): RecoveryProjection => {
  if (event.type === 'RecoveryClassified') {
    return {
      ...projection,
      latestClassification: event.payload as RecoveryClassifiedPayload,
      parked: false,
    };
  }

  if (event.type === 'StoryLaunchLeaseAcquired') {
    return {
      ...projection,
      activeStoryLaunchLease: event.payload as StoryLaunchLeaseAcquiredPayload,
    };
  }

  if (event.type === 'DuplicateLaunchBlocked') {
    return {
      ...projection,
      duplicateLaunch: event.payload as DuplicateLaunchBlockedPayload,
    };
  }

  if (event.type === 'RecoveryActionPlanned') {
    return {
      ...projection,
      latestPlan: event.payload as RecoveryActionPlannedPayload,
      parked: false,
    };
  }

  if (event.type === 'RecoveryActionApplied') {
    return projection.parked ? { ...projection, parked: false } : projection;
  }

  if (event.type === 'StoryLaunchLeaseCleared') {
    return foldLeaseCleared(projection, event.payload as StoryLaunchLeaseClearedPayload);
  }

  if (event.type === 'ReconciliationBlocked') {
    return {
      ...projection,
      parked: true,
    };
  }

  return projection;
};

const foldLeaseCleared = (
  projection: RecoveryProjection,
  payload: StoryLaunchLeaseClearedPayload,
): RecoveryProjection => {
  const activeLease = projection.activeStoryLaunchLease;
  const activeMatches =
    activeLease !== undefined &&
    activeLease.storyLaunchKey === payload.storyLaunchKey &&
    activeLease.leaseEpoch === payload.clearedLeaseEpoch;

  if (!activeMatches) {
    return projection;
  }

  const { activeStoryLaunchLease: _activeStoryLaunchLease, ...rest } = projection;
  return {
    ...rest,
    parked: false,
  };
};
