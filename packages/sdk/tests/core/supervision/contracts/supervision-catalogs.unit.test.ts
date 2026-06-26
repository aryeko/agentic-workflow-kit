import { describe, expect, it } from 'vitest';

import { LIVENESS_ADVANCE_CLASSES, SUPERVISION_TIMER_NAMES } from '../../../../src/index.js';
import type { LivenessAdvanceClass, SupervisionTimerName } from '../../../../src/index.js';

import { assertNever, expectedAdvanceClasses, expectedTimerNames } from './shared.js';

const describeTimerName = (value: SupervisionTimerName): string => {
  switch (value) {
    case 'startup':
    case 'idle':
    case 'no-progress':
    case 'per-tool':
    case 'approval-SLA':
    case 'max-runtime':
      return value;
    default:
      return assertNever(value);
  }
};

const describeAdvanceClass = (value: LivenessAdvanceClass): string => {
  switch (value) {
    case 'startup-linkage':
    case 'worker-progress':
    case 'tool-completion':
    case 'approval-request':
    case 'terminal-observation':
      return value;
    default:
      return assertNever(value);
  }
};

describe('core-04-s1 supervision catalogs', () => {
  it('exports the exact runtime timer-name and advance-class catalogs', () => {
    expect(SUPERVISION_TIMER_NAMES.map(describeTimerName)).toEqual(expectedTimerNames);
    expect(LIVENESS_ADVANCE_CLASSES.map(describeAdvanceClass)).toEqual(expectedAdvanceClasses);
  });
});
