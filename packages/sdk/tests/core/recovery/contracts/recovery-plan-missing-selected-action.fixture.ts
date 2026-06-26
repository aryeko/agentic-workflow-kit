import type { RecoveryPlan } from '../../../../src/index.js';

// @ts-expect-error RecoveryPlan requires selectedAction.
const invalidPlan: RecoveryPlan = {
  planId: 'plan-recovery-01',
  classification: {
    state: 'provider-evidence-gap',
    actionSafety: 'operator-required',
    recommendedAction: 'park-for-operator',
    reason: 'provider evidence is incomplete',
    evidenceRefs: [],
  },
  sourceEventIds: ['evt-recovery-classified-01'],
};

void invalidPlan;
