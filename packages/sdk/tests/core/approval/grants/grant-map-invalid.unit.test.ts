import { describe, expect, it } from 'vitest';

import { answerApprovalDecision, mapPolicyGrantToScopedGrant } from 'sdk';

import { createDecision, createPlan, createRelay, createRequest, decisionEventId, sessionId } from './fixtures.js';

describe('mapPolicyGrantToScopedGrant invalid mappings', () => {
  it.each([
    ['per-command-prefix missing prefix', createPlan({ scope: 'per-command-prefix', command: undefined })],
    [
      'per-command-prefix empty prefix part',
      createPlan({ scope: 'per-command-prefix', command: undefined, commandPrefix: ['pnpm', ''] }),
    ],
    ['per-host missing host', createPlan({ scope: 'per-host', command: undefined, host: undefined })],
    ['per-host wildcard host', createPlan({ scope: 'per-host', command: undefined, host: '*' })],
    ['session missing session id', createPlan({ scope: 'session', sessionId: undefined })],
  ] as const)('rejects %s', (_name, grantPlan) => {
    const result = mapPolicyGrantToScopedGrant({
      request: createRequest({ requestedScope: grantPlan.scope }),
      grantPlan,
      decisionEventId,
      humanApproved: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.failureState).toBe('approval-grant-mapping-invalid');
    }
  });

  it.each([
    ['filesystem-permission'],
    ['file-change-once'],
    ['mcp-elicitation-content'],
    ['tool-user-input-content'],
  ] as const)('rejects unsupported Agent grant kind %s before relay', async (kind) => {
    const relay = createRelay();
    const result = await answerApprovalDecision({
      request: createRequest(),
      decision: createDecision({
        grant: {
          grantId: 'grant-unsupported',
          kind,
          scope: 'request',
          grantEventId: decisionEventId,
        },
      }),
      decisionEventId,
      relay,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        failureState: 'approval-grant-mapping-invalid',
        reason: `unsupported Agent grant kind: ${kind}`,
      },
    });
    expect(relay.answers).toEqual([]);
  });

  it('rejects session mapping that targets another session', () => {
    const result = mapPolicyGrantToScopedGrant({
      request: createRequest({ requestedScope: 'session' }),
      grantPlan: createPlan({ scope: 'session', sessionId: `${sessionId}-other` }),
      decisionEventId,
      humanApproved: true,
    });

    expect(result.ok).toBe(false);
  });

  it('rejects a missing grant plan when no deny disposition is supplied', () => {
    const result = mapPolicyGrantToScopedGrant({
      request: createRequest(),
      decisionEventId,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        failureState: 'approval-grant-mapping-invalid',
        reason: 'grant plan is required',
      },
    });
  });

  it('rejects deny dispositions without reason content', () => {
    const result = mapPolicyGrantToScopedGrant({
      request: createRequest(),
      deny: { disposition: 'continue', reason: ' ' },
      decisionEventId,
    });

    expect(result.ok).toBe(false);
  });

  it('rejects host mappings that do not match the recorded request host', () => {
    const result = mapPolicyGrantToScopedGrant({
      request: createRequest({ subject: 'network', host: 'api.example.test', requestedScope: 'per-host' }),
      grantPlan: createPlan({ scope: 'per-host', command: undefined, host: 'other.example.test' }),
      decisionEventId,
    });

    expect(result.ok).toBe(false);
  });

  it('rejects command session mappings without command or policy-prefix evidence', () => {
    const result = mapPolicyGrantToScopedGrant({
      request: createRequest({ command: 'pnpm check', requestedScope: 'session' }),
      grantPlan: createPlan({ scope: 'session', sessionId: 'session-approval-01', command: 'npm test' }),
      decisionEventId,
      humanApproved: true,
    });

    expect(result.ok).toBe(false);
  });

  it.each([
    ['empty session prefix', []],
    ['blank session prefix part', ['pnpm', '']],
  ] as const)('rejects %s when command session mapping would otherwise widen', (_name, commandPrefix) => {
    const result = mapPolicyGrantToScopedGrant({
      request: createRequest({ command: 'pnpm check', requestedScope: 'session' }),
      grantPlan: createPlan({
        scope: 'session',
        sessionId: 'session-approval-01',
        command: 'npm test',
        commandPrefix,
      }),
      decisionEventId,
      humanApproved: true,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.failureState).toBe('approval-grant-mapping-invalid');
    }
  });

  it('rejects command session mappings when command evidence is absent', () => {
    const result = mapPolicyGrantToScopedGrant({
      request: createRequest({ command: undefined, requestedScope: 'session' }),
      grantPlan: createPlan({ scope: 'session', sessionId: 'session-approval-01', command: undefined }),
      decisionEventId,
      humanApproved: true,
    });

    expect(result.ok).toBe(false);
  });

  it('rejects file-change session mappings without bounded relative file paths', () => {
    const missingPaths = mapPolicyGrantToScopedGrant({
      request: createRequest({ subject: 'file-change', command: undefined, filePaths: undefined }),
      grantPlan: createPlan({ scope: 'session', command: undefined, sessionId: 'session-approval-01' }),
      decisionEventId,
      humanApproved: true,
    });
    const absolutePath = mapPolicyGrantToScopedGrant({
      request: createRequest({ subject: 'file-change', command: undefined, filePaths: ['/etc/passwd'] }),
      grantPlan: createPlan({ scope: 'session', command: undefined, sessionId: 'session-approval-01' }),
      decisionEventId,
      humanApproved: true,
    });

    expect(missingPaths.ok).toBe(false);
    expect(absolutePath.ok).toBe(false);
  });
});
