import { createAllowAutoMergeScenario, createRequest } from '../shared.js';

const base = createAllowAutoMergeScenario();

export const orchestratorDecideFixture = {
  ...base,
  request: createRequest({
    ...base.request,
    capability: 'orchestrator-decide',
    requestedAction: 'llm-adjudication',
  }),
};
