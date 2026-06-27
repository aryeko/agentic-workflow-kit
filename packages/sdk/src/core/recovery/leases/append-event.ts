import type {
  AppendIntent,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunWriter,
} from '../../run-lifecycle/contracts/index.js';

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
  const intent: AppendIntent<TPayload> = {
    domain: 'core-06',
    type: input.type,
    durability: 'barrier',
    payload: input.payload,
    occurredAt: input.occurredAt,
    ...(input.causationId === undefined ? {} : { causationId: input.causationId }),
  };

  return writer.append([intent]);
};
