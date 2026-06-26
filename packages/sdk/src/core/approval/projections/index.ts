import type {
  ApprovalDecisionRecordedPayload,
  ApprovalOutcomeRecordedPayload,
  ApprovalParkedPayload,
  ApprovalPendingPersistedPayload,
  ApprovalProjection,
  ApprovalResumedPayload,
  ApprovalState,
  PendingApprovalProjection,
} from '../contracts/index.js';
import type { RunEventEnvelope } from '../../run-lifecycle/contracts/index.js';

export const foldApprovalProjection = (runId: string, events: readonly RunEventEnvelope[]): ApprovalProjection => {
  const sortedEvents = [...events].sort(
    (left, right) => left.sequence - right.sequence || left.eventId.localeCompare(right.eventId),
  );
  return sortedEvents.reduce<ApprovalProjection>((projection, event) => foldEvent(projection, event), {
    runId,
    pendingByRequestId: {},
    latestDecisionByRequestId: {},
    latestOutcomeByRequestId: {},
    failureStateByRequestId: {},
  });
};

const foldEvent = (projection: ApprovalProjection, event: RunEventEnvelope): ApprovalProjection => {
  if (event.type === 'ApprovalPendingPersisted') {
    return foldPending(projection, event as RunEventEnvelope<ApprovalPendingPersistedPayload>);
  }

  if (event.type === 'ApprovalDecisionRecorded') {
    return foldDecision(projection, event as RunEventEnvelope<ApprovalDecisionRecordedPayload>);
  }

  if (event.type === 'ApprovalParked') {
    return foldParked(projection, event as RunEventEnvelope<ApprovalParkedPayload>);
  }

  if (event.type === 'ApprovalResumed') {
    return foldResumed(projection, event as RunEventEnvelope<ApprovalResumedPayload>);
  }

  if (event.type === 'ApprovalOutcomeRecorded') {
    return foldOutcome(projection, event as RunEventEnvelope<ApprovalOutcomeRecordedPayload>);
  }

  return projection;
};

const foldPending = (
  projection: ApprovalProjection,
  event: RunEventEnvelope<ApprovalPendingPersistedPayload>,
): ApprovalProjection => {
  const payload = event.payload;
  const row: PendingApprovalProjection = {
    requestId: payload.requestId,
    runId: payload.runId,
    sessionId: payload.sessionId,
    state: 'pending',
    requestEventId: payload.sourceRequestEventId,
    pendingEventId: event.eventId,
    answerChannelRef: payload.answerChannelRef,
    answerChannelPersistable: payload.answerChannelPersistable,
    ...(payload.liveAnswerDeadline === undefined ? {} : { liveAnswerDeadline: payload.liveAnswerDeadline }),
    decisionDeadline: payload.decisionDeadline,
    policyRef: payload.policyRef,
  };

  return {
    ...projection,
    pendingByRequestId: {
      ...projection.pendingByRequestId,
      [payload.requestId]: row,
    },
  };
};

const foldDecision = (
  projection: ApprovalProjection,
  event: RunEventEnvelope<ApprovalDecisionRecordedPayload>,
): ApprovalProjection => {
  const { decision } = event.payload;
  const pending = projection.pendingByRequestId[decision.requestId];
  const nextState: ApprovalState =
    decision.decision === 'human-required'
      ? 'human-required'
      : decision.decision === 'grant'
        ? 'auto-granted'
        : (pending?.state ?? 'pending');

  return {
    ...projection,
    pendingByRequestId:
      pending === undefined
        ? projection.pendingByRequestId
        : {
            ...projection.pendingByRequestId,
            [decision.requestId]: {
              ...pending,
              state: nextState,
              latestDecisionEventId: event.eventId,
            },
          },
    latestDecisionByRequestId: {
      ...projection.latestDecisionByRequestId,
      [decision.requestId]: decision,
    },
    operatorAttention:
      decision.decision === 'human-required'
        ? { requestId: decision.requestId, reason: 'human-required', sourceEventId: event.eventId }
        : projection.operatorAttention,
  };
};

const foldParked = (
  projection: ApprovalProjection,
  event: RunEventEnvelope<ApprovalParkedPayload>,
): ApprovalProjection => {
  const pending = projection.pendingByRequestId[event.payload.requestId];
  if (pending === undefined) {
    return projection;
  }

  return {
    ...projection,
    pendingByRequestId: {
      ...projection.pendingByRequestId,
      [event.payload.requestId]: {
        ...pending,
        state: 'parked',
        parkedEventId: event.eventId,
      },
    },
    operatorAttention: {
      requestId: event.payload.requestId,
      reason: 'parked',
      sourceEventId: event.eventId,
    },
  };
};

const foldResumed = (
  projection: ApprovalProjection,
  event: RunEventEnvelope<ApprovalResumedPayload>,
): ApprovalProjection => {
  const pending = projection.pendingByRequestId[event.payload.requestId];
  if (pending === undefined) {
    return projection;
  }

  return {
    ...projection,
    pendingByRequestId: {
      ...projection.pendingByRequestId,
      [event.payload.requestId]: {
        ...pending,
        state: 'resumed',
        resumedEventId: event.eventId,
      },
    },
  };
};

const foldOutcome = (
  projection: ApprovalProjection,
  event: RunEventEnvelope<ApprovalOutcomeRecordedPayload>,
): ApprovalProjection => {
  const { outcome } = event.payload;
  const pending = projection.pendingByRequestId[outcome.requestId];
  const failureStateByRequestId =
    outcome.failureState === undefined
      ? projection.failureStateByRequestId
      : { ...projection.failureStateByRequestId, [outcome.requestId]: outcome.failureState };

  return {
    ...projection,
    pendingByRequestId:
      pending === undefined
        ? projection.pendingByRequestId
        : {
            ...projection.pendingByRequestId,
            [outcome.requestId]: {
              ...pending,
              state: outcome.outcome,
              latestOutcomeEventId: event.eventId,
              ...(outcome.failureState === undefined ? {} : { failureState: outcome.failureState }),
            },
          },
    latestOutcomeByRequestId: {
      ...projection.latestOutcomeByRequestId,
      [outcome.requestId]: outcome,
    },
    failureStateByRequestId,
  };
};
