import { describe, expect, it } from 'vitest';

import { mapPolicyGrantToScopedGrant } from 'sdk';

import { createPlan, createRequest, decisionEventId } from './fixtures.js';

describe('missing command grant fixture', () => {
  it('returns approval-grant-mapping-invalid when per-command evidence is absent', () => {
    const result = mapPolicyGrantToScopedGrant({
      request: createRequest({ command: undefined }),
      grantPlan: createPlan({ command: undefined }),
      decisionEventId,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        failureState: 'approval-grant-mapping-invalid',
        reason: 'per-command requires exact command evidence',
      },
    });
  });
});
