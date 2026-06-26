import { describe, expect, it } from 'vitest';

import { LIVENESS_REASONS, LIVENESS_STATES } from '../../../../src/index.js';
import type { LivenessReason, LivenessState } from '../../../../src/index.js';

import { assertNever, expectedLivenessReasons, expectedLivenessStates } from './shared.js';

const describeState = (value: LivenessState): string => {
  switch (value) {
    case 'not-started':
    case 'starting':
    case 'active':
    case 'waiting-for-approval':
    case 'approval-overdue':
    case 'stale':
    case 'supervision-lost':
    case 'termination-requested':
    case 'terminated':
      return value;
    default:
      return assertNever(value);
  }
};

const describeReason = (value: LivenessReason): string => {
  switch (value) {
    case 'startup-timeout':
    case 'idle-timeout':
    case 'no-progress-timeout':
    case 'tool-timeout':
    case 'approval-sla-exceeded':
    case 'max-runtime-exceeded':
    case 'event-cursor-unavailable':
    case 'session-linkage-ambiguous':
    case 'agent-progress-unobservable':
    case 'tool-tracking-unavailable':
    case 'termination-unavailable':
    case 'termination-unproven':
    case 'worker-terminal-observed':
      return value;
    default:
      return assertNever(value);
  }
};

describe('core-04-s1 liveness catalogs', () => {
  it('exports the exact runtime state and reason catalogs', () => {
    expect(LIVENESS_STATES.map(describeState)).toEqual(expectedLivenessStates);
    expect(LIVENESS_REASONS.map(describeReason)).toEqual(expectedLivenessReasons);
  });
});
