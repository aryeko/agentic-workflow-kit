import type { RecoveryPlanInput } from '../../../../src/index.js';

// @ts-expect-error RecoveryPlanInput requires policyRef.
const invalidPlanInput: RecoveryPlanInput = {
  runId: 'run-recovery-01',
  mode: 'assisted',
  requestedAction: 'request-termination',
  scope: {
    runId: 'run-recovery-01',
    operationId: 'recovery-plan-01',
    providerScopes: [],
  },
  evaluatedThrough: {
    runId: 'run-recovery-01',
    afterSequence: 64,
  },
};

void invalidPlanInput;
