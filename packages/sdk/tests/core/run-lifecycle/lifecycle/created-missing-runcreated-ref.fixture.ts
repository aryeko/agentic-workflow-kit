import type { RunLifecycleTransitionPayload } from '../../../../src/index.js';

import { makeTransitionPayload } from './fixtures.js';

export const createdMissingRunCreatedRefFixture: RunLifecycleTransitionPayload = makeTransitionPayload({
  from: null,
  to: 'created',
  sourceEventIds: ['Evidence:evt-created'],
});
