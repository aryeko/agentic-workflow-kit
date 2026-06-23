import type { RunLifecycleState, RunLifecycleTransitionPayload } from '../../../../src/index.js';

import { makeTransitionPayload, TERMINAL_LIFECYCLE_STATES } from './fixtures.js';

export const postTerminalTransitionFixtures: Array<{
  from: RunLifecycleState;
  payload: RunLifecycleTransitionPayload;
}> = TERMINAL_LIFECYCLE_STATES.map((from) => ({
  from,
  payload: makeTransitionPayload({
    from,
    to: 'running',
    sourceEventIds: ['Evidence:evt-post-terminal'],
  }),
}));
