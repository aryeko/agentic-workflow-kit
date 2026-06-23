import { createAllowAutoMergeScenario, createPolicyDecision, createRequest } from '../shared.js';

const base = createAllowAutoMergeScenario();

export const policyDeniesFixture = {
  ...base,
  request: createRequest({
    ...base.request,
    policyDecision: createPolicyDecision({
      permits: false,
      denialReason: 'policy says no',
    }),
  }),
};
