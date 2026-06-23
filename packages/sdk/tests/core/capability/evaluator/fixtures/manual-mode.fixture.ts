import { createAllowAutoMergeScenario, createRequest } from '../shared.js';

const base = createAllowAutoMergeScenario();

export const manualModeFixture = {
  ...base,
  request: createRequest({
    ...base.request,
    mode: 'manual',
  }),
};
