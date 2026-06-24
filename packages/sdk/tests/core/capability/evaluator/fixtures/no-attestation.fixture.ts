import { createAllowAutoMergeScenario, createReplay } from '../shared.js';

const base = createAllowAutoMergeScenario();

export const noAttestationFixture = {
  ...base,
  replay: createReplay({
    ...base.replay,
    events: base.replay.events.filter((event) => event.type !== 'CapabilityAttestation'),
    lastSequence: 2,
  }),
};
