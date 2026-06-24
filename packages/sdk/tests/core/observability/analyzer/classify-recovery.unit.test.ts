import { describe, expect, it } from 'vitest';

import { classifyTrigger } from '../../../../src/core/observability/analyzer/index.js';

import { createProjections, createRecoveryEvent } from './shared.js';

describe('core-07-s2 classify recovery triggers', () => {
  it('classifies recovery decision events as recovery-decision', () => {
    const projections = createProjections();

    for (const type of [
      'RecoveryClassified',
      'RecoveryActionPlanned',
      'RecoveryActionApplied',
      'ReconciliationBlocked',
    ] as const) {
      const event = createRecoveryEvent(`evt-${type}`, 20, type);
      const trigger = classifyTrigger(event, projections);

      expect(trigger?.kind).toBe('recovery-decision');
      expect(trigger?.eventRef.eventId).toBe(event.eventId);
    }
  });
});
