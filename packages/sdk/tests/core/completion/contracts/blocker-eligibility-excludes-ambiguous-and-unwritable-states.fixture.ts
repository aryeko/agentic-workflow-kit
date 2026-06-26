import type { BlockerEvidenceEligibleState } from '../../../../src/index.js';

// @ts-expect-error Ambiguous head states are not blocker-evidence eligible.
const invalidCompletionState: BlockerEvidenceEligibleState = 'head-ambiguous';

// @ts-expect-error Unwritable completion states are not blocker-evidence eligible.
const invalidEventLogState: BlockerEvidenceEligibleState = 'event-log-unwritable';

// @ts-expect-error Unwritable merge states are not blocker-evidence eligible.
const invalidMergeState: BlockerEvidenceEligibleState = 'merge-intent-unwritable';

void invalidCompletionState;
void invalidEventLogState;
void invalidMergeState;
