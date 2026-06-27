import type { RecoveryProjection } from '../../../../src/index.js';

// @ts-expect-error RecoveryProjection requires parked.
const invalidProjection: RecoveryProjection = {
  runId: 'run-recovery-01',
};

void invalidProjection;
