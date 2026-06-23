import { createAllowAutoMergeScenario, createReplay } from '../shared.js';

const base = createAllowAutoMergeScenario();

export const degradedReplayFixture = {
  ...base,
  replay: createReplay({
    ...base.replay,
    health: 'interior-corrupt',
    healthRecords: [
      {
        kind: 'interior-corrupt',
        detectedAt: '2026-06-23T12:01:00.000Z',
        storageHealth: 'log-interior-corrupt',
        detail: 'checksum mismatch',
      },
    ],
  }),
};
