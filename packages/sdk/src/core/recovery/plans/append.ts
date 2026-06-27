import type { AppendIntent, RunAppendReceipt, RunWriter } from '../../run-lifecycle/contracts/index.js';
import type { Result } from '../../../foundation/storage/index.js';

import type { RecoveryPlansFailure } from './types.js';
import { unwritableFailure } from './types.js';

export const appendRecoveryBarrier = <TPayload>(
  writer: RunWriter,
  type: string,
  payload: TPayload,
  occurredAt: string,
  phase: 'classified' | 'plan' | 'apply',
  causationId?: string,
): Result<RunAppendReceipt, RecoveryPlansFailure> => {
  const intent: AppendIntent<TPayload> = {
    domain: 'core-06',
    type,
    durability: 'barrier',
    payload,
    occurredAt,
    ...(causationId === undefined ? {} : { causationId }),
  };

  const appended = writer.append([intent]);
  if (!appended.ok) {
    return { ok: false, error: unwritableFailure(phase, appended.error) };
  }
  return appended;
};
