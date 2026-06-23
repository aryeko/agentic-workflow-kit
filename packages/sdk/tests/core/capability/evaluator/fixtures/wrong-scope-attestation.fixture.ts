import { createAllowAutoMergeScenario, createAttestationEvent, createReplay } from '../shared.js';

const base = createAllowAutoMergeScenario();

const events = [
  base.replay.events[0],
  base.replay.events[1],
  createAttestationEvent('evt-forge-inspect-wrong-scope', 3, 'Forge', 'canInspectProtection', {
    scope: 'repo:aryeko/workflow-kit/pr:99/head#zzz999',
    freshnessKey: 'forge:pr-99',
  }),
  ...base.replay.events.slice(3),
];

export const wrongScopeAttestationFixture = {
  ...base,
  replay: createReplay({
    ...base.replay,
    events,
    lastSequence: events[events.length - 1]?.sequence ?? 0,
  }),
};
