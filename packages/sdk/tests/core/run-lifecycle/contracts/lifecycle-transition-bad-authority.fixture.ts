import type { RunLifecycleTransitionPayload } from '../../../../src/index.js';

const invalidLifecycleTransition: RunLifecycleTransitionPayload = {
  from: 'created',
  to: 'configured',
  reason: 'manual override',
  authority: 'user',
  sourceEventIds: ['evt-created'],
};

void invalidLifecycleTransition;
