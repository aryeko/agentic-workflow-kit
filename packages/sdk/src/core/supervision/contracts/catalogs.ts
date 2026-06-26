export const SUPERVISION_TIMER_NAMES = [
  'startup',
  'idle',
  'no-progress',
  'per-tool',
  'approval-SLA',
  'max-runtime',
] as const;

export type SupervisionTimerName = (typeof SUPERVISION_TIMER_NAMES)[number];

export const LIVENESS_ADVANCE_CLASSES = [
  'startup-linkage',
  'worker-progress',
  'tool-completion',
  'approval-request',
  'terminal-observation',
] as const;

export type LivenessAdvanceClass = (typeof LIVENESS_ADVANCE_CLASSES)[number];

export const LIVENESS_STATES = [
  'not-started',
  'starting',
  'active',
  'waiting-for-approval',
  'approval-overdue',
  'stale',
  'supervision-lost',
  'termination-requested',
  'terminated',
] as const;

export type LivenessState = (typeof LIVENESS_STATES)[number];

export const LIVENESS_REASONS = [
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
] as const;

export type LivenessReason = (typeof LIVENESS_REASONS)[number];
