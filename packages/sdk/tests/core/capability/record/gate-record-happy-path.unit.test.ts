import type { AppendIntent } from 'sdk';
import { describe, expect, it } from 'vitest';

import { appendGateRecord } from '../../../../src/core/capability/record/index.js';

import { createWriter, gateRecordPayloadFixture, runAppendReceiptFixture } from './shared.js';

describe('core-02-s3 appendGateRecord happy path', () => {
  it('returns the writer receipt and pins the append intent fields', async () => {
    let capturedIntent: AppendIntent | undefined;
    const writer = createWriter((batch) => {
      capturedIntent = batch[0];

      return { ok: true, value: runAppendReceiptFixture };
    });

    const result = await appendGateRecord(gateRecordPayloadFixture, writer);

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(`expected success, got ${result.error.token}`);
    }

    expect(result.value.eventIds[0]).toBe('fixed-id');
    expect(capturedIntent).toMatchObject({
      type: 'CapabilityGateRecord',
      domain: 'core-02',
      durability: 'barrier',
      payload: gateRecordPayloadFixture,
      occurredAt: gateRecordPayloadFixture.evaluatedAt,
    });
  });
});
