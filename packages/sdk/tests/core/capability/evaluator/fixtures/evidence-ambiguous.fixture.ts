import { createAllowAutoMergeScenario, createEvidenceEvent, createReplay } from '../shared.js';

const base = createAllowAutoMergeScenario();

const events = [
  ...base.replay.events,
  createEvidenceEvent('evt-evidence-head-contradiction', 7, 'evidence:forge-pr-head', { value: 'def456' }),
];

export const evidenceAmbiguousFixture = {
  ...base,
  replay: createReplay({
    ...base.replay,
    events,
    lastSequence: events[events.length - 1]?.sequence ?? 0,
  }),
};
