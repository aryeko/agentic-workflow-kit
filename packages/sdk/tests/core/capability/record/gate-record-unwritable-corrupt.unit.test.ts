import { describe, expect, it } from 'vitest';

import { appendGateRecord, GateRecordUnwritable } from '../../../../src/core/capability/record/index.js';

import { createWriter, gateRecordPayloadFixture } from './shared.js';

describe('core-02-s3 appendGateRecord interior-corrupt failure', () => {
  it('maps interior-corrupt to gate-record-unwritable', async () => {
    const writer = createWriter(() => ({
      ok: false,
      error: {
        code: 'interior-corrupt',
        message: 'event log corrupt',
        retryable: false,
      },
    }));

    const result = await appendGateRecord(gateRecordPayloadFixture, writer);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected failure');
    }

    expect(result.error.token).toBe('gate-record-unwritable');
    expect(result.error).toBeInstanceOf(GateRecordUnwritable);
    expect(result.error.causeCode).toBe('interior-corrupt');
  });
});
