import { describe, expect, it } from 'vitest';

import { classifyTrigger } from '../../../../src/core/observability/analyzer/index.js';

import {
  createLifecycleTransitionEvent,
  createProjections,
  createRunCreatedEvent,
  createUnknownEvent,
} from './shared.js';

describe('core-07-s2 classify non-trigger events', () => {
  it('returns null when no trigger condition matches', () => {
    const projections = createProjections();

    expect(
      classifyTrigger(createLifecycleTransitionEvent('evt-running', 30, 'running', 'created'), projections),
    ).toBeNull();
    expect(classifyTrigger(createRunCreatedEvent('evt-created', 31), projections)).toBeNull();
    expect(classifyTrigger(createUnknownEvent('evt-unknown', 32), projections)).toBeNull();
  });
});
