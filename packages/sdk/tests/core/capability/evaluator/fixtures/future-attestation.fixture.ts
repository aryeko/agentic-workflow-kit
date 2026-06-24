import { createAllowAutoMergeScenario, createAttestationEvent, createReplay } from '../shared.js';

const base = createAllowAutoMergeScenario();

const events = [
  base.replay.events[0],
  base.replay.events[1],
  createAttestationEvent('evt-forge-inspect-future', 3, 'Forge', 'canInspectProtection', {
    at: '2026-06-23T12:05:00.000Z',
  }),
  ...base.replay.events.slice(3),
];

export const futureAttestationFixture = {
  ...base,
  replay: createReplay({
    ...base.replay,
    events,
    lastSequence: events[events.length - 1]?.sequence ?? 0,
  }),
};
