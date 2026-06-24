import type { CapabilityGatePolicyDecision } from '../../../../../src/core/capability/evaluator/index.js';

const invalidPolicyDecision: CapabilityGatePolicyDecision = {
  policyRef: 'policy:auto-merge',
};

void invalidPolicyDecision;
