import type { ApprovalMode } from '../../../../src/core/approval/contracts/index.js';

// @ts-expect-error ApprovalMode excludes auto.
const invalidMode: ApprovalMode = 'auto';

void invalidMode;
