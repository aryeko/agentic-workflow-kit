import { describe, expect, it } from 'vitest';

import { parkApproval } from '../../../../src/core/approval/pending/index.js';

import { createRequest, decisionDeadline, evaluatedAt, requestId, runId, sessionId } from './fixtures.js';

describe('parkApproval decision', () => {
  it('copies the exact park-decision schema and source fields', () => {
    const decision = parkApproval({
      request: createRequest(),
      reason: 'operator-attention',
      decisionDeadline,
      parkedAt: evaluatedAt,
      sourceEventIds: ['evt-pending-01', 'evt-decision-01'],
    });

    expect(decision).toEqual({
      schema: 'kit-vnext.approval-park-decision.v1',
      requestId,
      runId,
      sessionId,
      reason: 'operator-attention',
      decisionDeadline,
      parkedAt: evaluatedAt,
      sourceEventIds: ['evt-pending-01', 'evt-decision-01'],
    });
  });
});
