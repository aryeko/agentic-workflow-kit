import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';
import { project } from '../../../../src/core/run-lifecycle/projections/index.js';

import { ambiguousLinkageFixture } from './fixtures/ambiguous-linkage.fixture.js';
import { degradedReplayFixture } from './fixtures/degraded-replay.fixture.js';
import {
  createAllowAutoMergeScenario,
  createEvent,
  createProjections,
  createReplay,
  createRequest,
  createScope,
} from './shared.js';

describe('core-02-s2 deny run-log-degraded', () => {
  it('denies degraded replays before attestation evaluation', () => {
    const payload = evaluateCapabilityGate(
      degradedReplayFixture.request,
      degradedReplayFixture.replay,
      degradedReplayFixture.projections,
    );

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('run-log-degraded');
  });

  it('denies tail-repaired replay health as degraded run-log input', () => {
    const scenario = createAllowAutoMergeScenario();
    const payload = evaluateCapabilityGate(
      scenario.request,
      createReplay({
        ...scenario.replay,
        health: 'tail-repaired',
        healthRecords: [
          {
            kind: 'tail-repaired',
            detectedAt: '2026-06-23T12:01:00.000Z',
            firstAffectedSequence: 9,
            lastValidSequence: 8,
            storageHealth: 'log-tail-repaired',
            detail: 'truncated incomplete tail frame',
          },
        ],
      }),
      scenario.projections,
    );

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('run-log-degraded');
  });

  it('denies ambiguous linkage as degraded run-log input', () => {
    const payload = evaluateCapabilityGate(
      ambiguousLinkageFixture.request,
      ambiguousLinkageFixture.replay,
      ambiguousLinkageFixture.projections,
    );

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('run-log-degraded');
  });

  it('denies ambiguous linkage projected from conflicting owning session links', () => {
    const scenario = createAllowAutoMergeScenario();
    const replayEvents = [
      ...scenario.replay.events,
      createEvent({
        eventId: 'evt-session-1',
        sequence: 7,
        domain: 'core-01',
        type: 'SessionLinked',
        payload: {
          linkOrdinal: 1,
          sessionId: 'session-1',
          linkRole: 'primary',
          startedAt: '2026-06-23T11:00:00.000Z',
          sourceEventId: 'evt-session-source-1',
        },
      }),
      createEvent({
        eventId: 'evt-session-2',
        sequence: 8,
        domain: 'core-01',
        type: 'SessionLinked',
        payload: {
          linkOrdinal: 2,
          sessionId: 'session-2',
          linkRole: 'primary',
          startedAt: '2026-06-23T11:05:00.000Z',
          sourceEventId: 'evt-session-source-2',
        },
      }),
    ];
    const replayWithAmbiguousLinks = {
      ...scenario.replay,
      events: replayEvents,
      lastSequence: 8,
    };
    const projected = project(scenario.request.runId, () => ({ ok: true, value: replayWithAmbiguousLinks }));

    expect(projected.ok).toBe(true);
    if (!projected.ok) {
      throw new Error(projected.error.code);
    }

    const payload = evaluateCapabilityGate(scenario.request, replayWithAmbiguousLinks, projected.value);

    expect(projected.value.launch.linkage).toBe('ambiguous');
    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('run-log-degraded');
  });

  it('allows unknown linkage when replay and projections are otherwise usable', () => {
    const scenario = createAllowAutoMergeScenario();
    const payload = evaluateCapabilityGate(
      scenario.request,
      scenario.replay,
      createProjections({
        ...scenario.projections,
        launch: {
          ...scenario.projections.launch,
          linkage: 'unknown',
        },
      }),
    );

    expect(payload.decision).toBe('allow');
  });

  it('denies unknown linkage for auto-recover gates', () => {
    const scenario = createAllowAutoMergeScenario();
    const payload = evaluateCapabilityGate(
      createRequest({
        capability: 'auto-recover',
        requestedAction: 'recover-run',
      }),
      scenario.replay,
      createProjections({
        ...scenario.projections,
        launch: {
          ...scenario.projections.launch,
          linkage: 'unknown',
        },
      }),
    );

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('run-log-degraded');
  });

  it('denies auto-recover after terminal lifecycle projection', () => {
    const scenario = createAllowAutoMergeScenario();
    const payload = evaluateCapabilityGate(
      createRequest({
        capability: 'auto-recover',
        requestedAction: 'recover-run',
      }),
      scenario.replay,
      createProjections({
        ...scenario.projections,
        state: {
          ...scenario.projections.state,
          lifecycle: 'completed',
        },
        summary: {
          ...scenario.projections.summary,
          status: 'completed',
        },
      }),
    );

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('run-log-degraded');
  });

  it('denies missing projections as degraded run-log input', () => {
    const payload = evaluateCapabilityGate(
      degradedReplayFixture.request,
      degradedReplayFixture.replay,
      undefined as never,
    );

    expect(payload.decision).toBe('deny');
    expect(payload.failureReason).toBe('run-log-degraded');
  });

  it('denies cross-run request, replay, and projection inputs', () => {
    const scenario = createAllowAutoMergeScenario();
    const cases = [
      {
        request: createRequest({ scope: createScope({ runId: 'run-other' }) }),
        replay: scenario.replay,
        projections: scenario.projections,
      },
      {
        request: scenario.request,
        replay: { ...scenario.replay, runId: 'run-other' },
        projections: scenario.projections,
      },
      {
        request: scenario.request,
        replay: scenario.replay,
        projections: createProjections({
          summary: {
            ...scenario.projections.summary,
            runId: 'run-other',
          },
        }),
      },
    ];

    for (const input of cases) {
      const payload = evaluateCapabilityGate(input.request, input.replay, input.projections);

      expect(payload.decision).toBe('deny');
      expect(payload.failureReason).toBe('run-log-degraded');
    }
  });
});
