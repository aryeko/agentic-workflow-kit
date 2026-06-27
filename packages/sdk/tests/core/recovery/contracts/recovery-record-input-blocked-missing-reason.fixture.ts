import type { RecoveryRecordInput } from '../../../../src/index.js';

// @ts-expect-error blocked RecoveryRecordInput requires blockedReason.
const invalidRecordInput: RecoveryRecordInput = {
  runId: 'run-recovery-01',
  plan: {
    planId: 'plan-recovery-01',
    classification: {
      state: 'provider-evidence-gap',
      actionSafety: 'operator-required',
      recommendedAction: 'park-for-operator',
      reason: 'provider evidence is incomplete',
      evidenceRefs: [],
    },
    selectedAction: 'park-for-operator',
    sourceEventIds: ['evt-recovery-classified-01'],
  },
  outcome: 'blocked',
  evaluatedThrough: {
    runId: 'run-recovery-01',
    afterSequence: 64,
  },
  sourceEventIds: ['evt-recovery-classified-01', 'evt-recovery-plan-01'],
};

void invalidRecordInput;
