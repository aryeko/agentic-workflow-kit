import { createAllowAutoMergeScenario, createAttestationEvent, createReplay } from '../shared.js';

const base = createAllowAutoMergeScenario();

const events = [
  base.replay.events[0],
  base.replay.events[1],
  createAttestationEvent('evt-forge-inspect-negative', 3, 'Forge', 'canInspectProtection', {
    result: 'negative',
  }),
  ...base.replay.events.slice(3),
];

export const negativeAttestationFixture = {
  ...base,
  replay: createReplay({
    ...base.replay,
    events,
    lastSequence: events[events.length - 1]?.sequence ?? 0,
  }),
};
