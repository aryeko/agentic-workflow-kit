import { SUPERVISION_TIMER_NAMES, type LivenessReason, type SupervisionTimerName } from '../contracts/index.js';
import type { LivenessTimerExpiredPayload } from '../contracts/index.js';

import { addMs } from '../liveness/fold-liveness-shared.js';

import type { EvaluateSupervisionTimersInput, SupervisionTimerEvaluation, SupervisionTimerStatus } from './types.js';

export const DEFAULT_SUPERVISION_TIMER_POLICY = {
  startupMs: 120_000,
  idleMs: 15 * 60_000,
  noProgressMs: 45 * 60_000,
  perToolMs: 30 * 60_000,
  approvalSlaMs: 24 * 60 * 60_000,
  maxRuntimeMs: 8 * 60 * 60_000,
} as const;

const TIMER_REASON: Record<SupervisionTimerName, LivenessReason> = {
  startup: 'startup-timeout',
  idle: 'idle-timeout',
  'no-progress': 'no-progress-timeout',
  'per-tool': 'tool-timeout',
  'approval-SLA': 'approval-sla-exceeded',
  'max-runtime': 'max-runtime-exceeded',
};

const timerDurationMs = (input: EvaluateSupervisionTimersInput, timer: SupervisionTimerName): number => {
  const policy = input.timerPolicy ?? DEFAULT_SUPERVISION_TIMER_POLICY;
  switch (timer) {
    case 'startup':
      return policy.startupMs;
    case 'idle':
      return policy.idleMs;
    case 'no-progress':
      return policy.noProgressMs;
    case 'per-tool':
      return policy.perToolMs;
    case 'approval-SLA':
      return policy.approvalSlaMs;
    case 'max-runtime':
      return policy.maxRuntimeMs;
  }
};

const isTerminalStopTimer = (timer: SupervisionTimerName): boolean =>
  timer === 'approval-SLA' || timer === 'max-runtime';

const isTimerArmed = (input: EvaluateSupervisionTimersInput, timer: SupervisionTimerName): boolean => {
  const evidence = input.timerEvidence?.[timer];
  if (!evidence?.basisAt) {
    return false;
  }

  if (evidence.stoppedAt) {
    return false;
  }

  if (timer === 'per-tool' && input.projection.reason === 'tool-tracking-unavailable') {
    return false;
  }

  if (input.projection.terminal && isTerminalStopTimer(timer)) {
    return false;
  }

  return true;
};

const buildTimerStatus = (
  input: EvaluateSupervisionTimersInput,
  timer: SupervisionTimerName,
): SupervisionTimerStatus => {
  const evidence = input.timerEvidence?.[timer];
  const armed = isTimerArmed(input, timer);
  const deadline =
    evidence?.basisAt !== undefined
      ? addMs(evidence.basisAt, timerDurationMs(input, timer))
      : input.projection.timers[timer].deadline;
  const exceeded = armed && globalThis.Date.parse(input.sampledAt) > globalThis.Date.parse(deadline);

  return {
    armed,
    deadline,
    exceeded,
  };
};

const buildExpiredPayload = (
  input: EvaluateSupervisionTimersInput,
  timer: SupervisionTimerName,
  status: SupervisionTimerStatus,
): LivenessTimerExpiredPayload | undefined => {
  if (!status.exceeded) {
    return undefined;
  }

  const evidence = input.timerEvidence?.[timer];
  return {
    schema: 'kit-vnext.liveness-timer-expired.v1',
    runId: input.projection.runId,
    timer,
    reason: TIMER_REASON[timer],
    deadline: status.deadline,
    observedAt: input.sampledAt,
    ...(input.projection.currentSessionId === undefined ? {} : { sessionId: input.projection.currentSessionId }),
    ...(input.projection.workerHandleId === undefined ? {} : { workerHandleId: input.projection.workerHandleId }),
    ...(input.projection.lastWorkerEventSequence === undefined
      ? {}
      : { lastWorkerEventSequence: input.projection.lastWorkerEventSequence }),
    ...(input.projection.lastProgressSequence === undefined
      ? {}
      : { lastProgressSequence: input.projection.lastProgressSequence }),
    sourceEventIds: [...(evidence?.sourceEventIds ?? [])],
  };
};

export const evaluateSupervisionTimers = (input: EvaluateSupervisionTimersInput): SupervisionTimerEvaluation => {
  const timers = Object.fromEntries(
    SUPERVISION_TIMER_NAMES.map((timer) => [timer, buildTimerStatus(input, timer)]),
  ) as Record<SupervisionTimerName, SupervisionTimerStatus>;

  const expired = SUPERVISION_TIMER_NAMES.flatMap((timer) => {
    const payload = buildExpiredPayload(input, timer, timers[timer]);
    return payload ? [payload] : [];
  });

  return {
    policy: input.timerPolicy ?? DEFAULT_SUPERVISION_TIMER_POLICY,
    timers,
    expired,
  };
};
