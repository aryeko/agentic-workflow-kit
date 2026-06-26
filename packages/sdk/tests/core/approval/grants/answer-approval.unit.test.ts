import { describe, expect, it } from 'vitest';

import { answerApprovalDecision } from 'sdk';

import { createDecision, createGrant, createRelay, createRequest, decisionEventId } from './fixtures.js';

describe('answerApprovalDecision', () => {
  it('passes the committed decision event id and Decision.grant unchanged to the relay', async () => {
    const grant = createGrant({ grantId: 'grant-exact', command: 'pnpm check -- --coverage' });
    const relay = createRelay();
    const result = await answerApprovalDecision({
      request: createRequest({ command: 'pnpm check -- --coverage' }),
      decision: createDecision({ grant }),
      decisionEventId,
      relay,
    });

    expect(result.ok).toBe(true);
    expect(relay.answers).toEqual([
      {
        requestId: 'request-01',
        decisionEventId,
        grant,
      },
    ]);
    expect(JSON.stringify(relay.answers[0])).not.toContain('per-command');
  });
});
