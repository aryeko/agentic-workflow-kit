import { describe, expect, it } from 'vitest';

import { classifyTrigger } from '../../../../src/core/observability/analyzer/index.js';

import {
  createEvent,
  createLivenessStateChangedEvent,
  createProjections,
  createSupervisionLostEvent,
} from './shared.js';

describe('core-07-s2 classify supervision triggers', () => {
  it('classifies explicit and state-based supervision loss as supervision-lost', () => {
    const projections = createProjections();
    const directEvent = createSupervisionLostEvent('evt-supervision-lost', 12);
    const stateEvent = createLivenessStateChangedEvent('evt-liveness-supervision-lost', 13, 'supervision-lost');

    expect(classifyTrigger(directEvent, projections)?.kind).toBe('supervision-lost');
    expect(classifyTrigger(stateEvent, projections)?.kind).toBe('supervision-lost');
  });

  it('uses state payload fallback and ignores malformed liveness payloads', () => {
    const projections = createProjections();
    const stateOnlyEvent = createEvent({
      eventId: 'evt-supervision-state-only',
      sequence: 14,
      type: 'LivenessStateChanged',
      payload: {
        state: 'supervision-lost',
      },
    });
    const malformedPayloadEvent = createEvent({
      eventId: 'evt-supervision-malformed-payload',
      sequence: 15,
      type: 'LivenessStateChanged',
      payload: 'supervision-lost',
    });

    expect(classifyTrigger(stateOnlyEvent, projections)?.kind).toBe('supervision-lost');
    expect(classifyTrigger(malformedPayloadEvent, projections)).toBeNull();
  });
});
