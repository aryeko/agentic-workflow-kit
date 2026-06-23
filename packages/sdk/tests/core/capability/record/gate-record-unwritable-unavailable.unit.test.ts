import { describe, expect, it } from 'vitest';

import { appendGateRecord, GateRecordUnwritable } from '../../../../src/core/capability/record/index.js';

import { createWriter, gateRecordPayloadFixture } from './shared.js';

describe('core-02-s3 appendGateRecord event-log-unavailable failure', () => {
  it('maps event-log-unavailable to gate-record-unwritable and never returns allow-as-receipt', async () => {
    const writer = createWriter(() => ({
      ok: false,
      error: {
        code: 'event-log-unavailable',
        message: 'event log unavailable',
        retryable: true,
      },
    }));

    const result = await appendGateRecord(gateRecordPayloadFixture, writer);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error('expected failure');
    }

    expect(result.error.token).toBe('gate-record-unwritable');
    expect(result.error).toBeInstanceOf(GateRecordUnwritable);
    expect(result.error.causeCode).toBe('event-log-unavailable');
    expect('decision' in (result as unknown as Record<string, unknown>)).toBe(false);
  });
});
