import type { RunLifecycleState } from '../../run-lifecycle/contracts/index.js';
import type { Result } from '../../../foundation/storage/index.js';
import type { RecoveryPlan } from '../contracts/index.js';

import type {
  BuildRecoveryLifecycleEdgeRequestInput,
  RecoveryLifecycleEdgeRequest,
  RecoveryPlansFailure,
} from './types.js';
import { illegalLifecycleEdgeFailure } from './types.js';

const retryTargets: Partial<Record<RunLifecycleState, RunLifecycleState>> = {
  'runner-verifying': 'running',
  'forge-waiting': 'runner-verifying',
  'merge-waiting': 'forge-waiting',
  settling: 'merge-waiting',
};

const nonTerminalStates = new Set<RunLifecycleState>([
  'created',
  'configured',
  'task-snapshotted',
  'workspace-ready',
  'worker-starting',
  'running',
  'parked',
  'runner-verifying',
  'forge-waiting',
  'merge-waiting',
  'settling',
]);

const uniqueEventIds = (eventIds: readonly string[]): readonly string[] => [...new Set(eventIds)];

const targetForPlan = (plan: RecoveryPlan, from: RunLifecycleState): RunLifecycleState | undefined => {
  if (plan.selectedAction === 'retry-evidence-refresh') {
    return retryTargets[from];
  }
  return plan.lifecycleTarget;
};

export const buildRecoveryLifecycleEdgeRequest = (
  input: BuildRecoveryLifecycleEdgeRequestInput,
): Result<RecoveryLifecycleEdgeRequest | undefined, RecoveryPlansFailure> => {
  const sourceEventIds = uniqueEventIds(input.recoveryEventIds);
  if (sourceEventIds.length === 0) {
    return { ok: false, error: illegalLifecycleEdgeFailure() };
  }

  const target = targetForPlan(input.plan, input.from);
  if (input.plan.selectedAction === 'retry-evidence-refresh' && target === undefined) {
    return { ok: false, error: illegalLifecycleEdgeFailure() };
  }
  if (target === undefined) {
    return { ok: true, value: undefined };
  }

  const allowedTerminal = (target === 'blocked' || target === 'failed') && nonTerminalStates.has(input.from);
  const allowedRetry = retryTargets[input.from] === target;
  if (!allowedTerminal && !allowedRetry) {
    return { ok: false, error: illegalLifecycleEdgeFailure() };
  }

  return {
    ok: true,
    value: {
      authority: 'recovery',
      from: input.from,
      to: target,
      sourceEventIds,
    },
  };
};
