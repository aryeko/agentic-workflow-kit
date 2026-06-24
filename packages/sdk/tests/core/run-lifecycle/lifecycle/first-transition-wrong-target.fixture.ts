import type { RunLifecycleTransitionPayload } from '../../../../src/index.js';

import { makeTransitionPayload } from './fixtures.js';

export const firstTransitionWrongTargetFixture: RunLifecycleTransitionPayload = makeTransitionPayload({
  from: null,
  to: 'configured',
  sourceEventIds: ['RunCreated:evt-created'],
});
