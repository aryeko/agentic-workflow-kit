import { describe, expect, it } from 'vitest';

import { mapPolicyGrantToScopedGrant, recordApprovalOutcome, answerApprovalDecision } from 'sdk';

import { createPlan, createRequest as createGrantRequest, decisionEventId } from '../grants/fixtures.js';
import { createDecision, createRequest, createWriter, recordedAt } from './fixtures.js';

describe('approval grants and outcomes public imports', () => {
  it('exports grant mapping, answer delivery, and outcome recording functions', async () => {
    expect(mapPolicyGrantToScopedGrant).toBeTypeOf('function');
    expect(answerApprovalDecision).toBeTypeOf('function');
    expect(recordApprovalOutcome).toBeTypeOf('function');

    const grantResult = mapPolicyGrantToScopedGrant({
      request: createGrantRequest(),
      grantPlan: createPlan(),
      decisionEventId,
    });
    const outcomeResult = await recordApprovalOutcome(
      {
        request: createRequest(),
        decision: createDecision(),
        outcome: 'answered',
        sourceEventIds: [decisionEventId],
        recordedAt,
        ids: () => 'outcome-public-01',
      },
      createWriter(),
    );

    expect(grantResult.ok).toBe(true);
    expect(outcomeResult.ok).toBe(true);
  });
});
