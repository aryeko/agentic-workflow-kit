export const RECOVERY_STATES = Object.freeze([
  'clean-terminal',
  'owned-session-resumable',
  'evidence-refresh-retryable',
  'owned-worker-stale-terminable',
  'safe-empty-restartable',
  'stale-launch-clearable',
  'operator-approval-needed',
  'lease-unavailable',
  'log-unwritable',
  'log-corrupt',
  'launch-duplicate-active',
  'owner-ambiguous',
  'termination-ambiguous',
  'supervision-stale-ambiguous',
  'merge-outcome-ambiguous',
  'provider-evidence-gap',
  'manual-edits-forbidden',
  'terminal-no-recovery',
] as const);

export type RecoveryState = (typeof RECOVERY_STATES)[number];

export const ACTION_SAFETY_CLASSES = Object.freeze(['auto-safe', 'operator-required', 'forbidden'] as const);

export type ActionSafetyClass = (typeof ACTION_SAFETY_CLASSES)[number];

export const RECOVERY_ACTIONS = Object.freeze([
  'none',
  'resume-owned-session',
  'retry-evidence-refresh',
  'request-termination',
  'restart-from-cleared-state',
  'clear-stale-launch',
  'park-for-operator',
  'block-run',
  'fail-run',
] as const);

export type RecoveryAction = (typeof RECOVERY_ACTIONS)[number];

export const PROVIDER_CONTROL_KINDS = Object.freeze([
  'agent-resume',
  'host-terminate',
  'forge-refresh',
  'work-source-release',
] as const);

export type ProviderControlKind = (typeof PROVIDER_CONTROL_KINDS)[number];
