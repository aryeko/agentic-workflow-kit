import type * as sdk from 'sdk';
import { recordReconciliationBlocked } from 'sdk';
import { describe, expect, it } from 'vitest';

import { blockedAtFixture, classifiedPayloadFixture, createWriterHarness } from './shared.js';

describe('core-06-s5 public sdk reconciliation imports', () => {
  it('imports the reconciliation blocked helper from the sdk entrypoint', () => {
    const writerHarness = createWriterHarness();
    const input: sdk.RecordReconciliationBlockedInput = {
      classified: classifiedPayloadFixture(),
      parkedReason: 'operator approval is required before recovery can continue',
      severity: 'operator-attention',
      blockedAt: blockedAtFixture,
      writer: writerHarness.writer,
    };
    const result: sdk.RecordReconciliationBlockedResult = recordReconciliationBlocked(input);

    expect(typeof recordReconciliationBlocked).toBe('function');
    expect(result.ok).toBe(true);
  });
});
