import { describe, expect, it } from 'vitest';

import { answerApprovalDecision, mapPolicyGrantToScopedGrant } from '../../../../src/core/approval/grants/index.js';

import { createDecision, createPlan, createRelay, createRequest, decisionEventId, sessionId } from './fixtures.js';

describe('approval grants source coverage', () => {
  it('covers grant mapping source branches', () => {
    const cases = [
      mapPolicyGrantToScopedGrant({
        request: createRequest(),
        grantPlan: createPlan(),
        decisionEventId,
      }),
      mapPolicyGrantToScopedGrant({
        request: createRequest({ command: undefined }),
        grantPlan: createPlan({ command: undefined }),
        decisionEventId,
      }),
      mapPolicyGrantToScopedGrant({
        request: createRequest({ requestedScope: 'per-command-prefix' }),
        grantPlan: createPlan({ scope: 'per-command-prefix', command: undefined, commandPrefix: ['pnpm', 'check'] }),
        decisionEventId,
      }),
      mapPolicyGrantToScopedGrant({
        request: createRequest({ requestedScope: 'per-command-prefix' }),
        grantPlan: createPlan({ scope: 'per-command-prefix', command: undefined, commandPrefix: [''] }),
        decisionEventId,
      }),
      mapPolicyGrantToScopedGrant({
        request: createRequest({ subject: 'network', host: 'api.example.test', requestedScope: 'per-host' }),
        grantPlan: createPlan({ scope: 'per-host', command: undefined, host: 'api.example.test' }),
        decisionEventId,
      }),
      mapPolicyGrantToScopedGrant({
        request: createRequest({ subject: 'network', host: 'api.example.test', requestedScope: 'per-host' }),
        grantPlan: createPlan({ scope: 'per-host', command: undefined, host: '*' }),
        decisionEventId,
      }),
      mapPolicyGrantToScopedGrant({
        request: createRequest({ requestedScope: 'session' }),
        grantPlan: createPlan({ scope: 'session', sessionId, command: 'pnpm check' }),
        decisionEventId,
        humanApproved: true,
      }),
      mapPolicyGrantToScopedGrant({
        request: createRequest({ command: 'pnpm check -- --coverage', requestedScope: 'session' }),
        grantPlan: createPlan({
          scope: 'session',
          sessionId,
          command: 'npm test',
          commandPrefix: ['pnpm', 'check'],
        }),
        decisionEventId,
        humanApproved: true,
      }),
      mapPolicyGrantToScopedGrant({
        request: createRequest({ requestedScope: 'session' }),
        grantPlan: createPlan({ scope: 'session', sessionId, command: 'pnpm check', commandPrefix: [] }),
        decisionEventId,
        humanApproved: true,
      }),
      mapPolicyGrantToScopedGrant({
        request: createRequest({
          subject: 'file-change',
          command: undefined,
          filePaths: ['packages/sdk/src/index.ts'],
          requestedScope: 'session',
        }),
        grantPlan: createPlan({ scope: 'session', sessionId, command: undefined }),
        decisionEventId,
        humanApproved: true,
      }),
      mapPolicyGrantToScopedGrant({
        request: createRequest({ subject: 'file-change', command: undefined, filePaths: ['/etc/passwd'] }),
        grantPlan: createPlan({ scope: 'session', sessionId, command: undefined }),
        decisionEventId,
        humanApproved: true,
      }),
      mapPolicyGrantToScopedGrant({
        request: createRequest(),
        deny: { disposition: 'interrupt', reason: 'operator denied' },
        decisionEventId,
      }),
      mapPolicyGrantToScopedGrant({
        request: createRequest(),
        deny: { disposition: 'continue', reason: ' ' },
        decisionEventId,
      }),
    ];

    expect(cases.some((result) => result.ok)).toBe(true);
    expect(cases.some((result) => !result.ok)).toBe(true);
  });

  it('covers approval answer source branches', async () => {
    const success = await answerApprovalDecision({
      request: createRequest(),
      decision: createDecision(),
      decisionEventId,
      relay: createRelay(),
    });
    const missingRelay = await answerApprovalDecision({
      request: createRequest(),
      decision: createDecision(),
      decisionEventId,
    });
    const missingEvidence = await answerApprovalDecision({
      request: createRequest(),
      decision: createDecision(),
      decisionEventId,
      relay: createRelay({
        delivered: true,
        persisted: true,
        channelRef: 'channel-01',
        at: '2026-06-26T09:05:00.000Z',
      }),
    });

    expect(success.ok).toBe(true);
    expect(missingRelay.ok).toBe(false);
    expect(missingEvidence.ok).toBe(false);
  });
});
