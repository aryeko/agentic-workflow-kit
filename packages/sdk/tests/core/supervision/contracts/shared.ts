import type {
  LivenessAdvanceClass,
  LivenessReason,
  LivenessState,
  SupervisionTimerName,
} from '../../../../src/index.js';

export const expectedLivenessStates = [
  'not-started',
  'starting',
  'active',
  'waiting-for-approval',
  'approval-overdue',
  'stale',
  'supervision-lost',
  'termination-requested',
  'terminated',
] as const satisfies readonly LivenessState[];

export const expectedLivenessReasons = [
  'startup-timeout',
  'idle-timeout',
  'no-progress-timeout',
  'tool-timeout',
  'approval-sla-exceeded',
  'max-runtime-exceeded',
  'event-cursor-unavailable',
  'session-linkage-ambiguous',
  'agent-progress-unobservable',
  'tool-tracking-unavailable',
  'termination-unavailable',
  'termination-unproven',
  'worker-terminal-observed',
] as const satisfies readonly LivenessReason[];

export const expectedTimerNames = [
  'startup',
  'idle',
  'no-progress',
  'per-tool',
  'approval-SLA',
  'max-runtime',
] as const satisfies readonly SupervisionTimerName[];

export const expectedAdvanceClasses = [
  'startup-linkage',
  'worker-progress',
  'tool-completion',
  'approval-request',
  'terminal-observation',
] as const satisfies readonly LivenessAdvanceClass[];

export const assertNever = (_value: never): never => {
  throw new Error('unreachable');
};
