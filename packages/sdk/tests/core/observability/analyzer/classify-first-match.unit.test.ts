import { describe, expect, it } from 'vitest';

import { classifyTrigger } from '../../../../src/core/observability/analyzer/index.js';

import { createLifecycleTransitionEvent, createProjections } from './shared.js';

describe('core-07-s2 first-match trigger precedence', () => {
  it('returns a single trigger object and stops at the earlier terminal-lifecycle match', () => {
    const event = createLifecycleTransitionEvent('evt-terminal-first', 33, 'completed');
    const trigger = classifyTrigger(event, createProjections());

    expect(trigger).not.toBeNull();
    expect(Array.isArray(trigger)).toBe(false);
    expect(trigger?.kind).toBe('terminal-lifecycle');
  });
});
