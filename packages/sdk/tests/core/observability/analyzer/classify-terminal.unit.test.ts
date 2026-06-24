import { describe, expect, it } from 'vitest';

import { classifyTrigger } from '../../../../src/core/observability/analyzer/index.js';

import { createLifecycleTransitionEvent, createProjections } from './shared.js';

describe('core-07-s2 classify terminal lifecycle triggers', () => {
  it('classifies completed, failed, and canceled lifecycle transitions as terminal-lifecycle', () => {
    const projections = createProjections();

    for (const to of ['completed', 'failed', 'canceled'] as const) {
      const event = createLifecycleTransitionEvent(`evt-${to}`, 10, to);
      const trigger = classifyTrigger(event, projections);

      expect(trigger?.kind).toBe('terminal-lifecycle');
      expect(trigger?.eventRef.eventId).toBe(event.eventId);
    }
  });
});
