import { describe, expect, it } from 'vitest';

import { mapPolicyGrantToScopedGrant } from 'sdk';

import { createPlan, createRequest, decisionEventId } from './fixtures.js';

describe('mapPolicyGrantToScopedGrant per-command', () => {
  it('maps exact command evidence to command-once request grant', () => {
    const result = mapPolicyGrantToScopedGrant({
      request: createRequest({ command: 'pnpm check' }),
      grantPlan: createPlan({ command: 'pnpm check' }),
      decisionEventId,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        grantId: 'grant-01',
        kind: 'command-once',
        scope: 'request',
        command: 'pnpm check',
        grantEventId: decisionEventId,
      },
    });
  });

  it('rejects a plan command that widens beyond the recorded request command', () => {
    const result = mapPolicyGrantToScopedGrant({
      request: createRequest({ command: 'pnpm check' }),
      grantPlan: createPlan({ command: 'pnpm ' }),
      decisionEventId,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.failureState).toBe('approval-grant-mapping-invalid');
    }
  });
});
