import { describe, expect, it } from 'vitest';

import {
  expireApproval,
  foldApprovalProjection,
  parkApproval,
  recordApprovalPending,
  resumePendingApproval,
} from 'sdk';

import { createRequest, decisionDeadline, evaluatedAt } from './fixtures.js';

describe('approval pending public imports', () => {
  it('exports pending, park, resume, expire, and projection fold functions', () => {
    expect(recordApprovalPending).toBeTypeOf('function');
    expect(resumePendingApproval).toBeTypeOf('function');
    expect(expireApproval).toBeTypeOf('function');
    expect(foldApprovalProjection).toBeTypeOf('function');
    expect(
      parkApproval({
        request: createRequest(),
        reason: 'operator-attention',
        decisionDeadline,
        parkedAt: evaluatedAt,
        sourceEventIds: ['evt-pending-01'],
      }),
    ).toMatchObject({ schema: 'kit-vnext.approval-park-decision.v1' });
  });
});
