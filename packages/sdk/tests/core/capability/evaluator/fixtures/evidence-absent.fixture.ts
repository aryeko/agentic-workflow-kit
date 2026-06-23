import { createAllowAutoMergeScenario, createReplay } from '../shared.js';

const base = createAllowAutoMergeScenario();

export const evidenceAbsentFixture = {
  ...base,
  replay: createReplay({
    ...base.replay,
    events: base.replay.events.filter(
      (event) =>
        event.type !== 'RecordedEvidence' ||
        (event.payload as { evidenceRef?: string }).evidenceRef !== 'evidence:verification',
    ),
    lastSequence: 5,
  }),
};
