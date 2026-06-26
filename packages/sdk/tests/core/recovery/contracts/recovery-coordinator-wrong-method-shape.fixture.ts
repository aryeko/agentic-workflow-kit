import type { RecoveryCoordinator } from '../../../../src/index.js';

const invalidCoordinator: RecoveryCoordinator = {
  // @ts-expect-error RecoveryCoordinator.classify must return RecoveryClassification.
  classify: () => 'provider-evidence-gap',
  plan: (_input, _classification) => ({
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
  }),
  record: () => ({
    runId: 'run-recovery-01',
    firstSequence: 65,
    lastSequence: 65,
    writerEpoch: 1,
    durability: 'barrier',
    eventIds: ['evt-recovery-record-01'],
    payloadDigests: ['sha256:recovery-record-01'],
    frameDigest: 'sha256:frame-01',
    health: 'ok',
  }),
};

void invalidCoordinator;
