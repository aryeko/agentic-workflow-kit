import type { AppendIntent, Result, RunAppendReceipt, RunWriter } from '../../run-lifecycle/contracts/index.js';
import type { CapabilityGateRecordPayload } from '../evaluator/index.js';

import { GateRecordUnwritable } from './types.js';

export const appendGateRecord = async (
  payload: CapabilityGateRecordPayload,
  writer: RunWriter,
): Promise<Result<RunAppendReceipt, GateRecordUnwritable>> => {
  const appendIntent: AppendIntent<CapabilityGateRecordPayload> = {
    domain: 'core-02',
    type: 'CapabilityGateRecord',
    durability: 'barrier',
    payload,
    occurredAt: payload.evaluatedAt,
  };

  const appendResult = await Promise.resolve(writer.append([appendIntent]));

  if (appendResult.ok) {
    return appendResult;
  }

  return {
    ok: false,
    error: new GateRecordUnwritable(appendResult.error),
  };
};
