import type { RunLifecycleTransitionPayload } from '../../../../src/index.js';

import { makeTransitionPayload } from './fixtures.js';

export const taskSnapshottedMissingSnapshotRefFixture: RunLifecycleTransitionPayload = makeTransitionPayload({
  from: 'configured',
  to: 'task-snapshotted',
  sourceEventIds: ['RunPolicyBound:evt-policy'],
});
