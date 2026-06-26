import { describe, expect, it } from 'vitest';

import { mapPolicyGrantToScopedGrant } from 'sdk';

import { createPlan, createRequest, decisionEventId, sessionId } from './fixtures.js';

describe('mapPolicyGrantToScopedGrant scoped grants', () => {
  it('maps per-command-prefix to command-policy-amendment turn grant with policy prefix evidence', () => {
    const result = mapPolicyGrantToScopedGrant({
      request: createRequest({ command: 'pnpm test -- --runInBand', requestedScope: 'per-command-prefix' }),
      grantPlan: createPlan({ scope: 'per-command-prefix', command: undefined, commandPrefix: ['pnpm', 'test'] }),
      decisionEventId,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        grantId: 'grant-01',
        kind: 'command-policy-amendment',
        scope: 'turn',
        commandPrefix: ['pnpm', 'test'],
        grantEventId: decisionEventId,
      },
    });
  });

  it('maps per-host to network-permission turn grant with exact host evidence', () => {
    const result = mapPolicyGrantToScopedGrant({
      request: createRequest({ subject: 'network', host: 'api.example.test', requestedScope: 'per-host' }),
      grantPlan: createPlan({ scope: 'per-host', command: undefined, host: 'api.example.test' }),
      decisionEventId,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        grantId: 'grant-01',
        kind: 'network-permission',
        scope: 'turn',
        networkHost: 'api.example.test',
        networkAction: 'allow',
        grantEventId: decisionEventId,
      },
    });
  });

  it('maps human-approved command session grant with session evidence', () => {
    const result = mapPolicyGrantToScopedGrant({
      request: createRequest({ requestedScope: 'session' }),
      grantPlan: createPlan({ scope: 'session', sessionId, command: 'pnpm check' }),
      decisionEventId,
      humanApproved: true,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        grantId: 'grant-01',
        kind: 'command-session',
        scope: 'session',
        command: 'pnpm check',
        grantEventId: decisionEventId,
      },
    });
  });

  it('maps human-approved file-change session grant with bounded file paths', () => {
    const result = mapPolicyGrantToScopedGrant({
      request: createRequest({
        subject: 'file-change',
        command: undefined,
        filePaths: ['packages/sdk/src/index.ts'],
        requestedScope: 'session',
      }),
      grantPlan: createPlan({ scope: 'session', sessionId, command: undefined }),
      decisionEventId,
      humanApproved: true,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        grantId: 'grant-01',
        kind: 'file-change-session',
        scope: 'session',
        filePaths: ['packages/sdk/src/index.ts'],
        grantEventId: decisionEventId,
      },
    });
  });

  it('rejects session grants without human approval', () => {
    const result = mapPolicyGrantToScopedGrant({
      request: createRequest({ requestedScope: 'session' }),
      grantPlan: createPlan({ scope: 'session', sessionId }),
      decisionEventId,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.reason).toBe('session grants require human approval');
    }
  });
});
