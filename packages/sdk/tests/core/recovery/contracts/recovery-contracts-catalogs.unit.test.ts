import { describe, expect, it } from 'vitest';

import {
  ACTION_SAFETY_CLASSES,
  PROVIDER_CONTROL_KINDS,
  RECOVERY_ACTIONS,
  RECOVERY_STATES,
} from '../../../../src/index.js';
import type { ActionSafetyClass, ProviderControlKind, RecoveryAction, RecoveryState } from '../../../../src/index.js';

import {
  assertNever,
  expectedActionSafetyClasses,
  expectedProviderControlKinds,
  expectedRecoveryActions,
  expectedRecoveryStates,
} from './shared.js';

const describeRecoveryState = (value: RecoveryState): string => {
  switch (value) {
    case 'clean-terminal':
    case 'owned-session-resumable':
    case 'evidence-refresh-retryable':
    case 'owned-worker-stale-terminable':
    case 'safe-empty-restartable':
    case 'stale-launch-clearable':
    case 'operator-approval-needed':
    case 'lease-unavailable':
    case 'log-unwritable':
    case 'log-corrupt':
    case 'launch-duplicate-active':
    case 'owner-ambiguous':
    case 'termination-ambiguous':
    case 'supervision-stale-ambiguous':
    case 'merge-outcome-ambiguous':
    case 'provider-evidence-gap':
    case 'manual-edits-forbidden':
    case 'terminal-no-recovery':
      return value;
    default:
      return assertNever(value);
  }
};

const describeActionSafetyClass = (value: ActionSafetyClass): string => {
  switch (value) {
    case 'auto-safe':
    case 'operator-required':
    case 'forbidden':
      return value;
    default:
      return assertNever(value);
  }
};

const describeRecoveryAction = (value: RecoveryAction): string => {
  switch (value) {
    case 'none':
    case 'resume-owned-session':
    case 'retry-evidence-refresh':
    case 'request-termination':
    case 'restart-from-cleared-state':
    case 'clear-stale-launch':
    case 'park-for-operator':
    case 'block-run':
    case 'fail-run':
      return value;
    default:
      return assertNever(value);
  }
};

const describeProviderControl = (value: ProviderControlKind): string => {
  switch (value) {
    case 'agent-resume':
    case 'host-terminate':
    case 'forge-refresh':
    case 'work-source-release':
      return value;
    default:
      return assertNever(value);
  }
};

describe('core-06-s1 recovery contract catalogs', () => {
  it('exports the exact runtime catalogs', () => {
    expect(RECOVERY_STATES.map(describeRecoveryState)).toEqual(expectedRecoveryStates);
    expect(ACTION_SAFETY_CLASSES.map(describeActionSafetyClass)).toEqual(expectedActionSafetyClasses);
    expect(RECOVERY_ACTIONS.map(describeRecoveryAction)).toEqual(expectedRecoveryActions);
    expect(PROVIDER_CONTROL_KINDS.map(describeProviderControl)).toEqual(expectedProviderControlKinds);
  });

  it('freezes all runtime catalogs', () => {
    expect(Object.isFrozen(RECOVERY_STATES)).toBe(true);
    expect(Object.isFrozen(ACTION_SAFETY_CLASSES)).toBe(true);
    expect(Object.isFrozen(RECOVERY_ACTIONS)).toBe(true);
    expect(Object.isFrozen(PROVIDER_CONTROL_KINDS)).toBe(true);
  });
});
