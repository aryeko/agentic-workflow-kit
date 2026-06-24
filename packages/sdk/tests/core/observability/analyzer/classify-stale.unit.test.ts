import { describe, expect, it } from 'vitest';

import { classifyTrigger } from '../../../../src/core/observability/analyzer/index.js';

import {
  createEvent,
  createLivenessStateChangedEvent,
  createLivenessTimerExpiredEvent,
  createProjections,
} from './shared.js';

describe('core-07-s2 classify stale-progress triggers', () => {
  it('classifies timer expiry and state-based stale transitions as stale-progress', () => {
    const projections = createProjections();
    const timerExpiredEvent = createLivenessTimerExpiredEvent('evt-stale', 14);
    const stateEvent = createLivenessStateChangedEvent('evt-liveness-stale', 15, 'stale');

    expect(classifyTrigger(timerExpiredEvent, projections)?.kind).toBe('stale-progress');
    expect(classifyTrigger(stateEvent, projections)?.kind).toBe('stale-progress');
  });

  it('uses state payload fallback and ignores malformed liveness payloads', () => {
    const projections = createProjections();
    const stateOnlyEvent = createEvent({
      eventId: 'evt-state-only',
      sequence: 16,
      type: 'LivenessStateChanged',
      payload: {
        state: 'stale',
      },
    });
    const malformedPayloadEvent = createEvent({
      eventId: 'evt-malformed-payload',
      sequence: 17,
      type: 'LivenessStateChanged',
      payload: 'stale',
    });

    expect(classifyTrigger(stateOnlyEvent, projections)?.kind).toBe('stale-progress');
    expect(classifyTrigger(malformedPayloadEvent, projections)).toBeNull();
  });
});
