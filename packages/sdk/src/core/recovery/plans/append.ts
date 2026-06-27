import type { RunAppendReceipt, RunWriter } from '../../run-lifecycle/contracts/index.js';
import type { Result } from '../../../foundation/storage/index.js';

import { buildRecoveryBarrierIntent } from '../shared/barrier-intent.js';
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
  const appended = writer.append([buildRecoveryBarrierIntent(type, payload, occurredAt, causationId)]);
  if (!appended.ok) {
    return { ok: false, error: unwritableFailure(phase, appended.error) };
  }
  return appended;
};
