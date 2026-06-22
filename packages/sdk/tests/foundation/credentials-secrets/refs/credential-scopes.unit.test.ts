import { describe, expect, it } from 'vitest';

import {
  createCredentialScope,
  stableCanonicalStringify,
  validateCredentialScopeUse,
  type CredentialRef,
} from '../../../../src/index.js';

const hashText = (value: string): string => `digest:${value}`;

const credentialRef: CredentialRef = {
  id: 'registry-read',
  kind: 'registry-read',
  purpose: 'install private packages',
  secret: {
    id: 'secret-ref:digest:{"key":"NPM_TOKEN","source":"env"}',
    source: 'env',
    key: 'NPM_TOKEN',
  },
  allowedParties: ['runner', 'worker'],
  allowedPhases: ['dependency-install', 'verification'],
  allowedHosts: ['registry.npmjs.org', 'npm.pkg.github.com'],
  ttlSeconds: 120,
  policyDigest: 'digest:policy-block',
};

describe('fnd-04-s1 credential scopes', () => {
  it('creates a credential scope with the story contract shape and stable scope digest evidence', () => {
    const scope = createCredentialScope({
      runId: 'run-123',
      taskId: 'task-456',
      operationId: 'operation-789',
      party: 'worker',
      phase: 'dependency-install',
      commandPrefix: 'pnpm install ',
      processId: 'pid-123',
      expiresAt: '2026-06-22T10:02:00.000Z',
      grantEventId: 'event-123',
    });

    expect(scope).toEqual({
      runId: 'run-123',
      taskId: 'task-456',
      operationId: 'operation-789',
      party: 'worker',
      phase: 'dependency-install',
      commandPrefix: 'pnpm install ',
      processId: 'pid-123',
      expiresAt: '2026-06-22T10:02:00.000Z',
      grantEventId: 'event-123',
    });

    const validated = validateCredentialScopeUse(credentialRef, scope, {
      hashText,
      now: '2026-06-22T10:01:00.000Z',
      issuedAt: '2026-06-22T10:00:00.000Z',
      host: 'registry.npmjs.org',
      command: 'pnpm install --frozen-lockfile',
    });

    expect(validated).toEqual({
      ok: true,
      value: {
        scope,
        policyDigest: 'digest:policy-block',
        scopeDigest: hashText(stableCanonicalStringify(scope)),
      },
    });
  });

  it.each([
    [
      'party is outside the allowed parties',
      {
        ref: {
          ...credentialRef,
          allowedParties: ['runner'] as const,
        },
        scope: {
          runId: 'run-123',
          taskId: 'task-456',
          operationId: 'operation-789',
          party: 'worker' as const,
          phase: 'dependency-install',
          expiresAt: '2026-06-22T10:02:00.000Z',
        },
        context: {
          now: '2026-06-22T10:01:00.000Z',
          issuedAt: '2026-06-22T10:00:00.000Z',
          host: 'registry.npmjs.org',
        },
        reason: 'party-not-allowed',
      },
    ],
    [
      'phase is outside the allowed phases',
      {
        ref: {
          ...credentialRef,
          allowedPhases: ['verification'] as const,
        },
        scope: {
          runId: 'run-123',
          taskId: 'task-456',
          operationId: 'operation-789',
          party: 'worker' as const,
          phase: 'dependency-install',
          expiresAt: '2026-06-22T10:02:00.000Z',
        },
        context: {
          now: '2026-06-22T10:01:00.000Z',
          issuedAt: '2026-06-22T10:00:00.000Z',
          host: 'registry.npmjs.org',
        },
        reason: 'phase-not-allowed',
      },
    ],
    [
      'host is outside the allowed hosts',
      {
        ref: credentialRef,
        scope: {
          runId: 'run-123',
          taskId: 'task-456',
          operationId: 'operation-789',
          party: 'worker' as const,
          phase: 'dependency-install',
          expiresAt: '2026-06-22T10:02:00.000Z',
        },
        context: {
          now: '2026-06-22T10:01:00.000Z',
          issuedAt: '2026-06-22T10:00:00.000Z',
          host: 'rubygems.org',
        },
        reason: 'host-not-allowed',
      },
    ],
    [
      'command falls outside the granted command prefix',
      {
        ref: credentialRef,
        scope: {
          runId: 'run-123',
          taskId: 'task-456',
          operationId: 'operation-789',
          party: 'worker' as const,
          phase: 'dependency-install',
          commandPrefix: 'pnpm install ',
          expiresAt: '2026-06-22T10:02:00.000Z',
        },
        context: {
          now: '2026-06-22T10:01:00.000Z',
          issuedAt: '2026-06-22T10:00:00.000Z',
          host: 'registry.npmjs.org',
          command: 'git push origin HEAD',
        },
        reason: 'command-prefix-mismatch',
      },
    ],
    [
      'scope expiry exceeds the configured ttl',
      {
        ref: credentialRef,
        scope: {
          runId: 'run-123',
          taskId: 'task-456',
          operationId: 'operation-789',
          party: 'worker' as const,
          phase: 'dependency-install',
          expiresAt: '2026-06-22T10:03:00.001Z',
        },
        context: {
          now: '2026-06-22T10:01:00.000Z',
          issuedAt: '2026-06-22T10:00:00.000Z',
          host: 'registry.npmjs.org',
        },
        reason: 'ttl-exceeded',
      },
    ],
    [
      'scope is already expired at use time',
      {
        ref: credentialRef,
        scope: {
          runId: 'run-123',
          taskId: 'task-456',
          operationId: 'operation-789',
          party: 'worker' as const,
          phase: 'dependency-install',
          expiresAt: '2026-06-22T10:00:59.000Z',
        },
        context: {
          now: '2026-06-22T10:01:00.000Z',
          issuedAt: '2026-06-22T10:00:00.000Z',
          host: 'registry.npmjs.org',
        },
        reason: 'scope-expired',
      },
    ],
  ])('denies scope use when %s', (_label, fixture) => {
    const scope = createCredentialScope(fixture.scope);

    expect(validateCredentialScopeUse(fixture.ref, scope, { hashText, ...fixture.context })).toEqual({
      ok: false,
      error: {
        token: 'credential-scope-denied',
        reason: fixture.reason,
        credentialRefId: fixture.ref.id,
        policyDigest: fixture.ref.policyDigest,
        scopeDigest: hashText(stableCanonicalStringify(scope)),
      },
    });
  });

  it('always denies Forge credentials to worker scopes even when the source policy attempts to allow them', () => {
    const forgeRef: CredentialRef = {
      ...credentialRef,
      id: 'forge-primary',
      kind: 'forge',
      allowedParties: ['runner', 'worker'],
      allowedPhases: ['push'],
      allowedHosts: ['github.com'],
    };
    const scope = createCredentialScope({
      runId: 'run-123',
      taskId: 'task-456',
      operationId: 'operation-789',
      party: 'worker',
      phase: 'push',
      commandPrefix: 'git push ',
      expiresAt: '2026-06-22T10:01:00.000Z',
      grantEventId: 'grant-123',
    });

    expect(
      validateCredentialScopeUse(forgeRef, scope, {
        hashText,
        now: '2026-06-22T10:00:30.000Z',
        issuedAt: '2026-06-22T10:00:00.000Z',
        host: 'github.com',
        command: 'git push origin HEAD',
      }),
    ).toEqual({
      ok: false,
      error: {
        token: 'worker-forge-credential-denied',
        reason: 'worker-forge',
        credentialRefId: 'forge-primary',
        policyDigest: 'digest:policy-block',
        scopeDigest: hashText(stableCanonicalStringify(scope)),
      },
    });
  });
});
