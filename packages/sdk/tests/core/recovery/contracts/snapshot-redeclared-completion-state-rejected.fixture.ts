import type { RecoveryEvidenceSnapshot } from '../../../../src/index.js';

const invalidSnapshot: RecoveryEvidenceSnapshot = {
  runId: 'run-recovery-01',
  evaluatedThrough: {
    runId: 'run-recovery-01',
    afterSequence: 64,
  },
  observedAt: '2026-06-27T10:10:00.000Z',
  state: {
    lifecycle: 'running',
    degradedHealth: 'ok',
  },
  launch: {
    linkage: 'known',
    linkHistory: [],
  },
  leases: {
    leaseHealth: 'ok',
  },
  evidenceRefs: [],
  providerGaps: [],
  completion: {
    // @ts-expect-error RecoveryEvidenceSnapshot completion states must use the core-05 unions.
    latestDecisionState: 'recovered-by-magic',
  },
};

void invalidSnapshot;
