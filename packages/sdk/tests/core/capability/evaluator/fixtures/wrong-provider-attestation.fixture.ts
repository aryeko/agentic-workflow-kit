import { createAllowAutoMergeScenario, createAttestationEvent, createReplay } from '../shared.js';

const base = createAllowAutoMergeScenario();

const events = [
  base.replay.events[0],
  base.replay.events[1],
  createAttestationEvent('evt-work-source-inspect', 3, 'Work Source', 'canInspectProtection', {
    scope: 'work-source:epic-3/task:core-02-s2-gate-evaluator',
    freshnessKey: 'work-source:core-02-s2',
  }),
  ...base.replay.events.filter(
    (event) =>
      event.type !== 'CapabilityAttestation' ||
      (event.payload as { capability?: string }).capability !== 'canInspectProtection',
  ),
];

export const wrongProviderAttestationFixture = {
  ...base,
  replay: createReplay({
    ...base.replay,
    events,
    lastSequence: events[events.length - 1]?.sequence ?? 0,
  }),
};
