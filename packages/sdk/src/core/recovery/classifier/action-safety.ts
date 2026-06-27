import type { RecoveryClassification, RecoveryState } from '../contracts/index.js';

export type RecoveryActionSafety = Pick<RecoveryClassification, 'actionSafety' | 'recommendedAction' | 'requiredGate'>;

const RECOVERY_ACTION_SAFETY: Readonly<Record<RecoveryState, RecoveryActionSafety>> = Object.freeze({
  'clean-terminal': Object.freeze({ actionSafety: 'forbidden', recommendedAction: 'none' }),
  'owned-session-resumable': Object.freeze({
    actionSafety: 'auto-safe',
    recommendedAction: 'resume-owned-session',
    requiredGate: 'auto-recover',
  }),
  'evidence-refresh-retryable': Object.freeze({
    actionSafety: 'auto-safe',
    recommendedAction: 'retry-evidence-refresh',
    requiredGate: 'auto-recover',
  }),
  'owned-worker-stale-terminable': Object.freeze({
    actionSafety: 'auto-safe',
    recommendedAction: 'request-termination',
    requiredGate: 'auto-recover',
  }),
  'safe-empty-restartable': Object.freeze({
    actionSafety: 'auto-safe',
    recommendedAction: 'restart-from-cleared-state',
    requiredGate: 'auto-recover',
  }),
  'stale-launch-clearable': Object.freeze({
    actionSafety: 'auto-safe',
    recommendedAction: 'clear-stale-launch',
    requiredGate: 'auto-recover',
  }),
  'operator-approval-needed': Object.freeze({
    actionSafety: 'operator-required',
    recommendedAction: 'park-for-operator',
  }),
  'lease-unavailable': Object.freeze({ actionSafety: 'operator-required', recommendedAction: 'block-run' }),
  'log-unwritable': Object.freeze({ actionSafety: 'operator-required', recommendedAction: 'block-run' }),
  'log-corrupt': Object.freeze({ actionSafety: 'forbidden', recommendedAction: 'fail-run' }),
  'launch-duplicate-active': Object.freeze({ actionSafety: 'forbidden', recommendedAction: 'block-run' }),
  'owner-ambiguous': Object.freeze({ actionSafety: 'forbidden', recommendedAction: 'block-run' }),
  'termination-ambiguous': Object.freeze({ actionSafety: 'forbidden', recommendedAction: 'block-run' }),
  'supervision-stale-ambiguous': Object.freeze({
    actionSafety: 'operator-required',
    recommendedAction: 'park-for-operator',
  }),
  'merge-outcome-ambiguous': Object.freeze({
    actionSafety: 'operator-required',
    recommendedAction: 'park-for-operator',
  }),
  'provider-evidence-gap': Object.freeze({
    actionSafety: 'operator-required',
    recommendedAction: 'park-for-operator',
  }),
  'manual-edits-forbidden': Object.freeze({ actionSafety: 'forbidden', recommendedAction: 'fail-run' }),
  'terminal-no-recovery': Object.freeze({ actionSafety: 'forbidden', recommendedAction: 'fail-run' }),
});

export const classifyActionSafety = (state: RecoveryState): RecoveryActionSafety => RECOVERY_ACTION_SAFETY[state];
