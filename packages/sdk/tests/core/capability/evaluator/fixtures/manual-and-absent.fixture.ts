import { createAllowAutoMergeScenario, createReplay, createRequest } from '../shared.js';

const base = createAllowAutoMergeScenario();

export const manualAndAbsentFixture = {
  ...base,
  request: createRequest({
    ...base.request,
    mode: 'manual',
  }),
  replay: createReplay({
    ...base.replay,
    events: base.replay.events.filter((event) => event.type !== 'CapabilityAttestation'),
    lastSequence: 2,
  }),
};
