import { describe, expect, it } from 'vitest';

import { classifyTrigger } from '../../../../src/core/observability/analyzer/index.js';

import { createLifecycleTransitionEvent, createProjections } from './shared.js';

describe('core-07-s2 classify blocked triggers', () => {
  it('classifies blocked lifecycle transitions as blocked-transition', () => {
    const event = createLifecycleTransitionEvent('evt-blocked', 11, 'blocked');
    const trigger = classifyTrigger(event, createProjections());

    expect(trigger?.kind).toBe('blocked-transition');
    expect(trigger?.eventRef.eventId).toBe(event.eventId);
  });
});
