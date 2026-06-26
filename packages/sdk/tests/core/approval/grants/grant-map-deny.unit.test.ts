import { describe, expect, it } from 'vitest';

import { mapPolicyGrantToScopedGrant } from 'sdk';

import { createRequest, decisionEventId } from './fixtures.js';

describe('mapPolicyGrantToScopedGrant deny dispositions', () => {
  it.each([
    ['continue', 'deny-continue'],
    ['interrupt', 'deny-interrupt'],
    ['park', 'deny-park'],
  ] as const)('maps deny-%s to request-scoped denial content', (disposition, kind) => {
    const result = mapPolicyGrantToScopedGrant({
      request: createRequest(),
      deny: { disposition, reason: 'operator denied risky command' },
      decisionEventId,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        grantId: `deny-${decisionEventId}`,
        kind,
        scope: 'request',
        content: { reason: 'operator denied risky command' },
        grantEventId: decisionEventId,
      },
    });
  });
});
