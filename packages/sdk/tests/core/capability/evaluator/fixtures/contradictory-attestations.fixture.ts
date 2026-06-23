import { createAllowAutoMergeScenario, createAttestationEvent, createReplay } from '../shared.js';

const base = createAllowAutoMergeScenario();

const events = [
  ...base.replay.events,
  createAttestationEvent('evt-forge-inspect-negative', 7, 'Forge', 'canInspectProtection', {
    result: 'negative',
  }),
];

export const contradictoryAttestationsFixture = {
  ...base,
  replay: createReplay({
    ...base.replay,
    events,
    lastSequence: events[events.length - 1]?.sequence ?? 0,
  }),
};
