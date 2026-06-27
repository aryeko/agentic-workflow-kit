import type { RecoveryRecordInput } from '../../../../src/index.js';

// @ts-expect-error RecoveryRecordInput requires sourceEventIds.
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
  blockedReason: 'operator attention required',
  evaluatedThrough: {
    runId: 'run-recovery-01',
    afterSequence: 64,
  },
};

void invalidRecordInput;
