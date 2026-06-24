import { createAllowAutoMergeScenario, createAttestationEvent, createEvidenceEvent, createReplay } from '../shared.js';

const base = createAllowAutoMergeScenario();

const events = [
  ...base.replay.events.filter((event) => event.eventId !== 'evt-forge-inspect'),
  createEvidenceEvent('evt-evidence-attestation-schema-only', 7, 'evidence:forge-attestation-schema-only', {
    supportKind: 'schema-only',
    value: 'schema says probe shape exists',
  }),
  createAttestationEvent('evt-forge-inspect-schema-only', 8, 'Forge', 'canInspectProtection', {
    evidenceRef: 'evidence:forge-attestation-schema-only',
  }),
];

export const nonReplayableAttestationEvidenceFixture = {
  ...base,
  replay: createReplay({
    ...base.replay,
    events,
    lastSequence: events[events.length - 1]?.sequence ?? 0,
  }),
};
