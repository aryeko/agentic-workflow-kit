import type { Result, RunAppendReceipt, RunWriter } from 'sdk';
import { appendGateRecord, type GateRecordUnwritable } from 'sdk';
import { describe, expect, it } from 'vitest';

import { gateRecordPayloadFixture, runAppendReceiptFixture } from './shared.js';

describe('core-02-s3 appendGateRecord type safety', () => {
  it('compiles as Promise<Result<RunAppendReceipt, GateRecordUnwritable>>', async () => {
    const writer: RunWriter = {
      append: () => ({ ok: true, value: runAppendReceiptFixture }),
      renew: () => ({ ok: true, value: writer }),
    };

    const typedResult: Promise<Result<RunAppendReceipt, GateRecordUnwritable>> = appendGateRecord(
      gateRecordPayloadFixture,
      writer,
    );
    const result = await typedResult;

    expect(result.ok).toBe(true);
  });
});
