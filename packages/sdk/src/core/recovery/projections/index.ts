import type {
  DuplicateLaunchBlockedPayload,
  RecoveryActionPlannedPayload,
  RecoveryClassifiedPayload,
  RecoveryProjection,
  StaleLaunchClearanceRequestedPayload,
  StoryLaunchLeaseAcquiredPayload,
  StoryLaunchLeaseClearedPayload,
} from '../contracts/index.js';
import type { RunEventEnvelope } from '../../run-lifecycle/contracts/index.js';

export const foldRecoveryProjection = (runId: string, events: readonly RunEventEnvelope[]): RecoveryProjection => {
  const sortedEvents = [...events].sort(
    (left, right) => left.sequence - right.sequence || left.eventId.localeCompare(right.eventId),
  );

  const projection = sortedEvents.reduce<ProjectionState>((current, event) => foldEvent(current, event), {
    runId,
    parked: false,
    pendingStaleLaunchClearanceByKey: {},
  });

  const { pendingStaleLaunchClearanceByKey: _pendingStaleLaunchClearanceByKey, ...publicProjection } = projection;
  return publicProjection;
};

type ProjectionState = RecoveryProjection & {
  readonly pendingStaleLaunchClearanceByKey: Readonly<Record<string, StaleLaunchClearanceRequestedPayload>>;
};

const foldEvent = (projection: ProjectionState, event: RunEventEnvelope): ProjectionState => {
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

  if (event.type === 'StaleLaunchClearanceRequested') {
    const payload = event.payload as StaleLaunchClearanceRequestedPayload;
    return {
      ...projection,
      pendingStaleLaunchClearanceByKey: {
        ...projection.pendingStaleLaunchClearanceByKey,
        [payload.storyLaunchKey]: payload,
      },
    };
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

const foldLeaseCleared = (projection: ProjectionState, payload: StoryLaunchLeaseClearedPayload): ProjectionState => {
  const activeLease = projection.activeStoryLaunchLease;
  const pendingStaleLaunchClearance = projection.pendingStaleLaunchClearanceByKey[payload.storyLaunchKey];
  const matchesPendingClearance =
    pendingStaleLaunchClearance !== undefined &&
    pendingStaleLaunchClearance.expiredLeaseEpoch === activeLease?.leaseEpoch &&
    pendingStaleLaunchClearance.nextLeaseEpoch === payload.clearedLeaseEpoch;
  const activeMatches =
    activeLease !== undefined &&
    activeLease.storyLaunchKey === payload.storyLaunchKey &&
    (activeLease.leaseEpoch === payload.clearedLeaseEpoch || matchesPendingClearance);

  if (!activeMatches) {
    return projection;
  }

  const { activeStoryLaunchLease: _activeStoryLaunchLease, pendingStaleLaunchClearanceByKey, ...rest } = projection;
  const { [payload.storyLaunchKey]: _cleared, ...remainingRequests } = pendingStaleLaunchClearanceByKey;
  return {
    ...rest,
    pendingStaleLaunchClearanceByKey: remainingRequests,
    parked: false,
  };
};
