import type { RunLifecycleTransitionPayload } from '../../../../src/index.js';

import { makeTransitionPayload } from './fixtures.js';

export const recoveryEdgeWrongAuthorityFixtures: RunLifecycleTransitionPayload[] = [
  makeTransitionPayload({
    from: 'runner-verifying',
    to: 'running',
    authority: 'system',
    sourceEventIds: ['RecoveryRetry:evt-1'],
  }),
  makeTransitionPayload({
    from: 'forge-waiting',
    to: 'runner-verifying',
    authority: 'system',
    sourceEventIds: ['RecoveryRetry:evt-2'],
  }),
  makeTransitionPayload({
    from: 'merge-waiting',
    to: 'forge-waiting',
    authority: 'system',
    sourceEventIds: ['RecoveryRetry:evt-3'],
  }),
  makeTransitionPayload({
    from: 'settling',
    to: 'merge-waiting',
    authority: 'system',
    sourceEventIds: ['RecoveryRetry:evt-4'],
  }),
  makeTransitionPayload({
    from: 'runner-verifying',
    to: 'running',
    authority: 'recovery',
    sourceEventIds: [],
  }),
];
