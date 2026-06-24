import { describe, expect, it } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { malformedAttestationEnvelopeFixture } from './fixtures/malformed-attestation-envelope.fixture.js';
import { nonReplayableAttestationEvidenceFixture } from './fixtures/non-replayable-attestation-evidence.fixture.js';
import { unresolvableEvidenceRefFixture } from './fixtures/unresolvable-evidence-ref.fixture.js';
import {
  createAllowAutoMergeScenario,
  createAttestationEvent,
  createEvent,
  createEvidenceEvent,
  createRequest,
  defaultEvidenceRefs,
} from './shared.js';

describe('core-02-s2 deny attestation non-replayable', () => {
  it('denies unresolved attestation evidence refs', () => {
    const payload = evaluateCapabilityGate(
      unresolvableEvidenceRefFixture.request,
      unresolvableEvidenceRefFixture.replay,
      unresolvableEvidenceRefFixture.projections,
    );

    expect(payload.failureReason).toBe('attestation-non-replayable');
  });

  it('denies malformed attestation envelopes', () => {
    const payload = evaluateCapabilityGate(
      malformedAttestationEnvelopeFixture.request,
      malformedAttestationEnvelopeFixture.replay,
      malformedAttestationEnvelopeFixture.projections,
    );

    expect(payload.failureReason).toBe('attestation-non-replayable');
  });

  it('denies attestations with empty identity fields', () => {
    for (const field of ['driverVersion', 'platform', 'freshnessKey'] as const) {
      const scenario = createAllowAutoMergeScenario();
      const payload = evaluateCapabilityGate(
        scenario.request,
        {
          ...scenario.replay,
          events: [
            ...scenario.replay.events.slice(0, 2),
            createAttestationEvent('evt-forge-inspect-empty-identity', 3, 'Forge', 'canInspectProtection', {
              [field]: '',
            }),
            ...scenario.replay.events.slice(3),
          ],
        },
        scenario.projections,
      );

      expect(payload.failureReason).toBe('attestation-non-replayable');
    }
  });

  it('denies positive attestations backed only by schema-only evidence', () => {
    const payload = evaluateCapabilityGate(
      nonReplayableAttestationEvidenceFixture.request,
      nonReplayableAttestationEvidenceFixture.replay,
      nonReplayableAttestationEvidenceFixture.projections,
    );

    expect(payload.failureReason).toBe('attestation-non-replayable');
  });

  it('denies positive attestations backed by evidence with an unrecognized support kind', () => {
    const scenario = createAllowAutoMergeScenario();
    const payload = evaluateCapabilityGate(
      createRequest({ evidenceRefs: [defaultEvidenceRefs[1]] }),
      {
        ...scenario.replay,
        events: [
          createEvidenceEvent('evt-evidence-head', 1, defaultEvidenceRefs[0], {
            supportKind: 'transcript' as never,
          }),
          ...scenario.replay.events.slice(1),
        ],
      },
      scenario.projections,
    );

    expect(payload.failureReason).toBe('attestation-non-replayable');
  });

  it('denies positive attestations backed by ambiguous evidence outside requested evidence refs', () => {
    const scenario = createAllowAutoMergeScenario();
    const ambiguousAttestationEvidence = createEvidenceEvent('evt-evidence-head-ambiguous', 7, defaultEvidenceRefs[0], {
      value: 'def456',
    });

    const payload = evaluateCapabilityGate(
      createRequest({ evidenceRefs: [defaultEvidenceRefs[1]] }),
      {
        ...scenario.replay,
        events: [...scenario.replay.events, ambiguousAttestationEvidence],
        lastSequence: ambiguousAttestationEvidence.sequence,
      },
      scenario.projections,
    );

    expect(payload.failureReason).toBe('attestation-non-replayable');
  });

  it('denies attestations backed only by evidence recorded after the gate time', () => {
    const scenario = createAllowAutoMergeScenario();
    const futureAttestationEvidence = createEvidenceEvent('evt-evidence-head-future', 7, defaultEvidenceRefs[0], {
      value: 'abc123',
    });
    const payload = evaluateCapabilityGate(
      createRequest({ evidenceRefs: [defaultEvidenceRefs[1]] }),
      {
        ...scenario.replay,
        events: [
          {
            ...futureAttestationEvidence,
            occurredAt: '2026-06-23T12:00:01.000Z',
            recordedAt: '2026-06-23T12:00:01.000Z',
          },
          ...scenario.replay.events.slice(1),
        ],
      },
      scenario.projections,
    );

    expect(payload.failureReason).toBe('attestation-non-replayable');
  });

  it('ignores malformed attestations recorded after the gate time', () => {
    const scenario = createAllowAutoMergeScenario();
    const futureMalformed = createEvent({
      eventId: 'evt-forge-inspect-malformed-future',
      sequence: 7,
      domain: 'Forge',
      type: 'CapabilityAttestation',
      occurredAt: '2026-06-23T12:00:01.000Z',
      recordedAt: '2026-06-23T12:00:01.000Z',
      payload: {
        capability: 'canInspectProtection',
        result: 'positive',
        evidenceRef: defaultEvidenceRefs[0],
        scope: 'repo:aryeko/workflow-kit/pr:42/head#abc123',
        driverVersion: '1.2.3',
        platform: 'darwin-arm64',
        freshnessKey: 'forge:pr-42',
        at: '2026-06-23T11:00:00.000Z',
      },
    });

    const payload = evaluateCapabilityGate(
      scenario.request,
      {
        ...scenario.replay,
        events: [...scenario.replay.events, futureMalformed],
        lastSequence: futureMalformed.sequence,
      },
      scenario.projections,
    );

    expect(payload.decision).toBe('allow');
    expect(payload.failureReason).toBeUndefined();
  });
});
