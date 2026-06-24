import type { RunLifecycleTransitionPayload } from '../../../../src/index.js';

import { makeTransitionPayload } from './fixtures.js';

export const configuredMissingPolicyBoundRefFixture: RunLifecycleTransitionPayload = makeTransitionPayload({
  from: 'created',
  to: 'configured',
  sourceEventIds: ['RunCreated:evt-created'],
});
