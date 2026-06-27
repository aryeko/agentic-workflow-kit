import type { Result, RunAppendFailure, RunAppendReceipt, RunWriter } from '../../run-lifecycle/contracts/index.js';
import { buildRecoveryBarrierIntent } from '../shared/barrier-intent.js';

type RecoveryLeaseEventType = 'StoryLaunchLeaseAcquired' | 'DuplicateLaunchBlocked' | 'StaleLaunchClearanceRequested';

type AppendRecoveryLeaseEventInput<TPayload> = {
  readonly type: RecoveryLeaseEventType;
  readonly occurredAt: string;
  readonly payload: TPayload;
  readonly causationId?: string;
};

export const appendRecoveryLeaseEvent = <TPayload>(
  writer: RunWriter,
  input: AppendRecoveryLeaseEventInput<TPayload>,
): Result<RunAppendReceipt, RunAppendFailure> => {
  return writer.append([buildRecoveryBarrierIntent(input.type, input.payload, input.occurredAt, input.causationId)]);
};
