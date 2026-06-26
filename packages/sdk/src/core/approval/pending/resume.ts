import type {
  ApprovalDecisionRecordedPayload,
  ApprovalFailureState,
  ApprovalPendingPersistedPayload,
  ApprovalResumedPayload,
  Decision,
  PendingApprovalProjection,
} from '../contracts/index.js';
import type { Result, RunEventEnvelope, RunReplay } from '../../run-lifecycle/contracts/index.js';
import type { CapabilityAttestation } from '../../../providers/attestation/index.js';

import { blockedDecision } from './decisions.js';
import { expireApproval } from './expire.js';
import { isExpired, toEpochMs } from './time.js';
import type {
  PendingWriter,
  ResumePendingApprovalCommit,
  ResumePendingApprovalFailure,
  ResumePendingApprovalInput,
} from './types.js';

export const resumePendingApproval = async (
  input: ResumePendingApprovalInput,
  writer: PendingWriter,
): Promise<Result<ResumePendingApprovalCommit, ResumePendingApprovalFailure>> => {
  const pending = findPending(input);
  if (pending === undefined) {
    return { ok: true, value: { decision: blockedDecision(input, 'approval-event-log-unavailable', []) } };
  }

  if (isExpired(pending.decisionDeadline, input.evaluatedAt)) {
    return expireApproval(
      {
        pending,
        decisionEventId: input.decisionEventId,
        evaluatedAt: input.evaluatedAt,
        sourceEventIds: [pending.pendingEventId],
      },
      writer,
    );
  }

  const blocked = resumeBlocker(input, pending);
  if (blocked !== undefined) {
    return { ok: true, value: { decision: blocked } };
  }

  const decision = findDecision(input.replay, input.decisionEventId, input.requestId);
  const grant = decision?.grant;
  if (grant === undefined) {
    return {
      ok: true,
      value: { decision: blockedDecision(input, 'approval-event-log-unavailable', [pending.pendingEventId]) },
    };
  }
  const resume = evaluateAttestation(input.replay, 'canResumeOwned', input.sessionId, input.evaluatedAt);
  const relay = evaluateAttestation(input.replay, 'canRelayApproval', input.sessionId, input.evaluatedAt);
  const persist = pending.answerChannelPersistable
    ? evaluateAttestation(input.replay, 'canPersistApprovalAnswerChannel', input.sessionId, input.evaluatedAt)
    : { freshPositive: true, eventIds: [] };
  const sourceEventIds = [
    pending.pendingEventId,
    input.decisionEventId,
    input.projections.launch.currentSession?.sourceEventId,
    ...resume.eventIds,
    ...relay.eventIds,
    ...persist.eventIds,
  ].filter((eventId): eventId is string => eventId !== undefined);
  const resumeDecision = {
    schema: 'kit-vnext.approval-resume-decision.v1' as const,
    requestId: input.requestId,
    runId: input.runId,
    sessionId: input.sessionId,
    decisionEventId: input.decisionEventId,
    outcome: 'resume' as const,
    grant,
    sourceEventIds,
    evaluatedAt: input.evaluatedAt,
  };
  const payload: ApprovalResumedPayload = {
    schema: 'kit-vnext.approval-resumed.v1',
    requestId: input.requestId,
    runId: input.runId,
    sessionId: input.sessionId,
    decisionEventId: input.decisionEventId,
    grant,
    resumedAt: input.evaluatedAt,
    sourceEventIds,
  };
  const appendResult = await Promise.resolve(
    writer.append([
      { domain: 'core-03', type: 'ApprovalResumed', durability: 'barrier', payload, occurredAt: input.evaluatedAt },
    ]),
  );
  if (!appendResult.ok) {
    return {
      ok: false,
      error: {
        reason: 'approval-event-log-unavailable',
        appendFailure: appendResult.error,
        decision: blockedDecision(input, 'approval-event-log-unavailable', sourceEventIds),
      },
    };
  }

  return {
    ok: true,
    value: {
      decision: resumeDecision,
      payload,
      eventId: appendResult.value.eventIds[0] ?? 'ApprovalResumed',
      appendReceipt: appendResult.value,
    },
  };
};

const resumeBlocker = (
  input: ResumePendingApprovalInput,
  pending: PendingApprovalProjection,
): ReturnType<typeof blockedDecision> | undefined => {
  const linkageFailure = evaluateLinkage(input);
  if (linkageFailure !== undefined) {
    return blockedDecision(input, linkageFailure, [pending.pendingEventId]);
  }

  const decision = findDecision(input.replay, input.decisionEventId, input.requestId);
  if (decision?.grant === undefined) {
    return blockedDecision(input, 'approval-event-log-unavailable', [pending.pendingEventId]);
  }

  if (input.channelAvailable === false) {
    return blockedDecision(input, 'approval-answer-channel-lost', [pending.pendingEventId, input.decisionEventId]);
  }

  const resume = evaluateAttestation(input.replay, 'canResumeOwned', input.sessionId, input.evaluatedAt);
  if (!resume.freshPositive) {
    return blockedDecision(input, 'approval-resume-capability-missing', [
      pending.pendingEventId,
      input.decisionEventId,
    ]);
  }

  const relay = evaluateAttestation(input.replay, 'canRelayApproval', input.sessionId, input.evaluatedAt);
  if (!relay.freshPositive) {
    return blockedDecision(input, 'approval-relay-missing', [pending.pendingEventId, input.decisionEventId]);
  }

  const persist = pending.answerChannelPersistable
    ? evaluateAttestation(input.replay, 'canPersistApprovalAnswerChannel', input.sessionId, input.evaluatedAt)
    : { freshPositive: true };
  return persist.freshPositive
    ? undefined
    : blockedDecision(input, 'approval-relay-missing', [pending.pendingEventId, input.decisionEventId]);
};

const findPending = (input: ResumePendingApprovalInput): PendingApprovalProjection | undefined => {
  const projected = input.approvalProjection?.pendingByRequestId[input.requestId];
  if (projected !== undefined) {
    return projected;
  }

  const event = input.replay.events
    .filter((candidate) => candidate.type === 'ApprovalPendingPersisted')
    .find((candidate): candidate is RunEventEnvelope<ApprovalPendingPersistedPayload> => {
      const payload = candidate.payload as Partial<ApprovalPendingPersistedPayload>;
      return (
        payload.requestId === input.requestId && payload.runId === input.runId && payload.sessionId === input.sessionId
      );
    });

  if (event === undefined) {
    return undefined;
  }

  return {
    requestId: event.payload.requestId,
    runId: event.payload.runId,
    sessionId: event.payload.sessionId,
    state: 'pending',
    requestEventId: event.payload.sourceRequestEventId,
    pendingEventId: event.eventId,
    answerChannelRef: event.payload.answerChannelRef,
    answerChannelPersistable: event.payload.answerChannelPersistable,
    ...(event.payload.liveAnswerDeadline === undefined ? {} : { liveAnswerDeadline: event.payload.liveAnswerDeadline }),
    decisionDeadline: event.payload.decisionDeadline,
    policyRef: event.payload.policyRef,
  };
};

const evaluateLinkage = (input: ResumePendingApprovalInput): ApprovalFailureState | undefined => {
  const current = input.projections.launch.currentSession;
  if (input.projections.launch.linkage !== 'known' || current === undefined || current.sessionId !== input.sessionId) {
    return 'approval-session-ambiguous';
  }

  return current.linkRole === 'primary' || current.linkRole === 'recovery' ? undefined : 'approval-owner-missing';
};

const findDecision = (replay: RunReplay, eventId: string, requestId: string): Decision | undefined => {
  const event = replay.events.find(
    (candidate) => candidate.eventId === eventId && candidate.type === 'ApprovalDecisionRecorded',
  );
  const payload = event?.payload as Partial<ApprovalDecisionRecordedPayload> | undefined;
  return payload?.decision?.requestId === requestId ? payload.decision : undefined;
};

const evaluateAttestation = (
  replay: RunReplay,
  capability: 'canResumeOwned' | 'canRelayApproval' | 'canPersistApprovalAnswerChannel',
  sessionId: string,
  evaluatedAt: string,
): { readonly freshPositive: boolean; readonly eventIds: readonly string[] } => {
  const gateTime = toEpochMs(evaluatedAt);
  const matches = replay.events.filter((event): event is RunEventEnvelope<CapabilityAttestation<string>> => {
    const payload = event.payload as Partial<CapabilityAttestation<string>>;
    const attestedAt = payload.at === undefined ? undefined : toEpochMs(payload.at);
    const expiresAt = payload.expiry === undefined ? undefined : toEpochMs(payload.expiry);
    return (
      event.type === 'CapabilityAttestation' &&
      event.domain === 'Agent' &&
      payload.capability === capability &&
      payload.scope === sessionId &&
      attestedAt !== undefined &&
      expiresAt !== undefined &&
      gateTime !== undefined &&
      attestedAt <= gateTime &&
      gateTime < expiresAt
    );
  });

  const hasNegative = matches.some((event) => event.payload.result === 'negative');
  const positives = matches.filter((event) => event.payload.result === 'positive');
  return { freshPositive: positives.length > 0 && !hasNegative, eventIds: positives.map((event) => event.eventId) };
};
