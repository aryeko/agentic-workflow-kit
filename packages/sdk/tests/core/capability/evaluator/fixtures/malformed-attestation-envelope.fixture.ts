import { createAllowAutoMergeScenario, createEvent, createReplay } from '../shared.js';

const base = createAllowAutoMergeScenario();

const events = [
  base.replay.events[0],
  base.replay.events[1],
  createEvent({
    eventId: 'evt-forge-inspect-malformed',
    sequence: 3,
    domain: 'Forge',
    type: 'CapabilityAttestation',
    payload: {
      capability: 'canInspectProtection',
      result: 'positive',
      evidenceRef: 'evidence:forge-pr-head',
      scope: 'repo:aryeko/workflow-kit/pr:42/head#abc123',
      driverVersion: '1.2.3',
      platform: 'darwin-arm64',
      freshnessKey: 'forge:pr-42',
      at: '2026-06-23T11:00:00.000Z',
    },
  }),
  ...base.replay.events.slice(3),
];

export const malformedAttestationEnvelopeFixture = {
  ...base,
  replay: createReplay({
    ...base.replay,
    events,
    lastSequence: events[events.length - 1]?.sequence ?? 0,
  }),
};
