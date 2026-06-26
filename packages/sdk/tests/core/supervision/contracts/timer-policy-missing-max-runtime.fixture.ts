import type { SupervisionTimerPolicy } from '../../../../src/core/supervision/contracts/index.js';

const invalidPolicy: SupervisionTimerPolicy = {
  startupMs: 120_000,
  idleMs: 900_000,
  noProgressMs: 2_700_000,
  perToolMs: 1_800_000,
  approvalSlaMs: 86_400_000,
};

void invalidPolicy;
