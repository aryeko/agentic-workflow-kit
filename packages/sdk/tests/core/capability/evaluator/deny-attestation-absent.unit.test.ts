import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { noAttestationFixture } from './fixtures/no-attestation.fixture.js';
import { wrongProviderAttestationFixture } from './fixtures/wrong-provider-attestation.fixture.js';
import { createAllowAutoMergeScenario } from './shared.js';

describe('core-02-s2 deny attestation absent', () => {
  it('denies when no committed matching attestation exists', () => {
    const payload = evaluateCapabilityGate(
      noAttestationFixture.request,
      noAttestationFixture.replay,
      noAttestationFixture.projections,
    );

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('attestation-absent');
  });

  it('denies when only the wrong provider claims the required capability', () => {
    const payload = evaluateCapabilityGate(
      wrongProviderAttestationFixture.request,
      wrongProviderAttestationFixture.replay,
      wrongProviderAttestationFixture.projections,
    );

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('attestation-absent');
  });

  it('denies when the only matching attestation was recorded after the gate time', () => {
    const scenario = createAllowAutoMergeScenario();
    const payload = evaluateCapabilityGate(
      scenario.request,
      {
        ...scenario.replay,
        events: scenario.replay.events.map((event) =>
          event.eventId === 'evt-forge-inspect'
            ? {
                ...event,
                occurredAt: '2026-06-23T12:00:01.000Z',
                recordedAt: '2026-06-23T12:00:01.000Z',
              }
            : event,
        ),
      },
      scenario.projections,
    );

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('attestation-absent');
  });

  it('denies queue actions without a merge-queue attestation', () => {
    const scenario = createAllowAutoMergeScenario();
    const payload = evaluateCapabilityGate(
      {
        ...scenario.request,
        requestedAction: 'enqueue-pull-request',
      },
      {
        ...scenario.replay,
        events: scenario.replay.events.filter(
          (event) => event.eventId !== 'evt-forge-merge-queue' && event.eventId !== 'evt-work-source-status',
        ),
      },
      scenario.projections,
    );

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('attestation-absent');
  });

  it('denies enqueue-and-complete actions without a merge-queue attestation', () => {
    const scenario = createAllowAutoMergeScenario();
    const payload = evaluateCapabilityGate(
      {
        ...scenario.request,
        requestedAction: 'enqueue-pull-request-and-complete-task',
      },
      {
        ...scenario.replay,
        events: scenario.replay.events.filter((event) => event.eventId !== 'evt-forge-merge-queue'),
      },
      scenario.projections,
    );

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('attestation-absent');
  });

  it('denies task-completing merge actions without a status-write attestation', () => {
    const scenario = createAllowAutoMergeScenario();
    const payload = evaluateCapabilityGate(
      {
        ...scenario.request,
        requestedAction: 'merge-pull-request-and-complete-task',
      },
      {
        ...scenario.replay,
        events: scenario.replay.events.filter((event) => event.eventId !== 'evt-work-source-status'),
      },
      scenario.projections,
    );

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('attestation-absent');
  });
});
