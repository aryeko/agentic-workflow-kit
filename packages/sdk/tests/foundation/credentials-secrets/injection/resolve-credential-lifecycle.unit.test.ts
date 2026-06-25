import { describe, expect, it, vi } from 'vitest';

import { issueEgressPolicy, planInjection, resolveCredential } from '../../../../src/index.js';
import { buildAuditSeed } from '../../../../src/foundation/credentials-secrets/injection/operation-audit.js';
import {
  createPositiveAttestation,
  egressSource,
  hashText,
  planDependencies,
  ref,
  scope,
} from './resolve-credential.test-helpers.js';

describe('fnd-04-s2 resolve credential lifecycle', () => {
  it('denies before material exposure as audit-write-unavailable when the required audit event cannot be recorded', () => {
    const resolveSecretMaterial = vi.fn(() => ({
      material: 'super-secret-value',
      materialHandle: 'memory://registry-read',
      fingerprintId: 'fp-registry-read',
    }));
    const policy = issueEgressPolicy(
      {
        refs: [ref],
        scope,
        egressSource,
      },
      {
        hashText,
        at: '2026-06-22T10:00:30.000Z',
        prevEventHash: 'digest:previous',
      },
    );
    const denied = resolveCredential(
      {
        ref,
        scope,
        egressConfinementRequired: true,
        redactionSet: {
          id: 'redaction-set-1',
          credentialRefIds: ['registry-read'],
          labels: {
            'registry-read': '[REDACTED:credential:registry-read]',
          },
          fingerprintIds: ['fp-registry-read'],
          expiresAt: '2026-06-22T10:02:00.000Z',
        },
        egressPolicy: policy.ok ? policy.value : undefined,
        injectionModes: ['env'],
      },
      {
        hashText,
        now: '2026-06-22T10:01:00.000Z',
        issuedAt: '2026-06-22T10:00:00.000Z',
        host: 'registry.npmjs.org',
        command: 'pnpm install --frozen-lockfile',
        at: '2026-06-22T10:01:05.000Z',
        prevEventHash: 'digest:previous',
        auditSinkAvailable: false,
        resolveSecretMaterial,
      },
    );

    expect(denied).toMatchObject({
      ok: false,
      reason: 'audit-write-unavailable',
      auditEvent: {
        reason: 'audit-write-unavailable',
        credentialRefDigest: buildAuditSeed(
          {
            refs: [ref],
            scope,
            at: '2026-06-22T10:01:05.000Z',
            prevEventHash: 'digest:previous',
          },
          hashText,
        ).credentialRefDigest,
        scopeDigest: buildAuditSeed(
          {
            refs: [ref],
            scope,
            at: '2026-06-22T10:01:05.000Z',
            prevEventHash: 'digest:previous',
          },
          hashText,
        ).scopeDigest,
      },
    });
    expect(resolveSecretMaterial).not.toHaveBeenCalled();
  });

  it('denies before capture as redaction-unavailable when the redaction set is missing', () => {
    const planned = planInjection(
      {
        refs: [ref],
        scope,
        bindingTemplates: [
          {
            credentialRefId: 'registry-read',
            mode: 'env',
            nameOrPath: 'NPM_TOKEN',
          },
        ],
        egressSource,
      },
      planDependencies,
    );
    expect(planned.ok).toBe(true);
    if (!planned.ok) {
      return;
    }

    const resolveSecretMaterial = vi.fn(() => ({
      material: 'super-secret-value',
      materialHandle: 'memory://registry-read',
      fingerprintId: 'fp-registry-read',
    }));
    const denied = resolveCredential(
      {
        ref,
        scope,
        egressConfinementRequired: true,
        requiredAuditEvent: planned.requiredAuditEvent,
        egressPolicy: planned.egressPolicy,
        injectionModes: ['env'],
      },
      {
        hashText,
        now: '2026-06-22T10:01:00.000Z',
        issuedAt: '2026-06-22T10:00:00.000Z',
        host: 'registry.npmjs.org',
        command: 'pnpm install --frozen-lockfile',
        at: '2026-06-22T10:01:05.000Z',
        prevEventHash: planned.requiredAuditEvent.eventHash,
        auditSinkAvailable: true,
        resolveSecretMaterial,
      },
    );

    expect(denied).toMatchObject({
      ok: false,
      reason: 'redaction-unavailable',
      auditEvent: {
        reason: 'redaction-unavailable',
      },
    });
    expect(resolveSecretMaterial).not.toHaveBeenCalled();
  });

  it('returns a started audit event on success, or credential-ref-unresolved without material exposure when the ref cannot be resolved', () => {
    const planned = planInjection(
      {
        refs: [ref],
        scope,
        bindingTemplates: [
          {
            credentialRefId: 'registry-read',
            mode: 'env',
            nameOrPath: 'NPM_TOKEN',
          },
        ],
        egressSource,
      },
      planDependencies,
    );
    expect(planned.ok).toBe(true);
    if (!planned.ok) {
      return;
    }

    const positiveAttestation = createPositiveAttestation({ ok: true, value: planned.egressPolicy });
    const unresolved = resolveCredential(
      {
        ref,
        scope,
        egressConfinementRequired: true,
        requiredAuditEvent: planned.requiredAuditEvent,
        redactionSet: planned.redactionSet,
        egressPolicy: planned.egressPolicy,
        injectionModes: ['env'],
        attestations: [positiveAttestation],
        attestationIds: ['attestation-1'],
      },
      {
        hashText,
        now: '2026-06-22T10:01:00.000Z',
        issuedAt: '2026-06-22T10:00:00.000Z',
        host: 'registry.npmjs.org',
        command: 'pnpm install --frozen-lockfile',
        at: '2026-06-22T10:01:05.000Z',
        prevEventHash: planned.requiredAuditEvent.eventHash,
        auditSinkAvailable: true,
        resolveSecretMaterial: () => undefined,
      },
    );

    expect(unresolved).toMatchObject({
      ok: false,
      reason: 'credential-ref-unresolved',
      auditEvent: {
        reason: 'credential-ref-unresolved',
      },
    });
  });

  it('resolves without attestation evidence when no egress policy is required', () => {
    const started = resolveCredential(
      {
        ref,
        scope,
        egressConfinementRequired: false,
        requiredAuditEvent: {
          type: 'CredentialUsePlanned',
          runId: 'run-123',
          taskId: 'task-456',
          operationId: 'operation-789',
          credentialRefIds: ['registry-read'],
          party: 'worker',
          phase: 'dependency-install',
          policyDigest: 'digest:policy-block',
          credentialRefDigest: 'digest:credential-refs',
          scopeDigest: 'digest:scope-block',
          grantEventId: 'grant-123',
          attestationEventIds: [],
          evidenceRefs: [],
          prevEventHash: 'digest:previous',
          eventHash: 'digest:planned',
          at: '2026-06-22T10:00:30.000Z',
          egressPolicyId: 'egress-policy:none',
          expiresAt: '2026-06-22T10:02:00.000Z',
          reason: 'scoped injection required',
        },
        redactionSet: {
          id: 'redaction-set-1',
          credentialRefIds: ['registry-read'],
          labels: {
            'registry-read': '[REDACTED:credential:registry-read]',
          },
          fingerprintIds: ['fp-registry-read'],
          expiresAt: '2026-06-22T10:02:00.000Z',
        },
        injectionModes: ['env'],
      },
      {
        hashText,
        now: '2026-06-22T10:01:00.000Z',
        issuedAt: '2026-06-22T10:00:00.000Z',
        host: 'registry.npmjs.org',
        command: 'pnpm install --frozen-lockfile',
        at: '2026-06-22T10:01:05.000Z',
        prevEventHash: 'digest:planned',
        auditSinkAvailable: true,
        resolveSecretMaterial: () => ({
          material: 'super-secret-value',
          materialHandle: 'memory://registry-read',
          fingerprintId: 'fp-registry-read',
        }),
      },
    );

    expect(started).toMatchObject({
      ok: true,
      credentialRefId: 'registry-read',
      auditEvent: {
        type: 'CredentialUseStarted',
        attestationEventIds: [],
        evidenceRefs: [],
      },
    });
  });

  it('denies on scope validation before secret resolution when the host is outside policy', () => {
    const resolveSecretMaterial = vi.fn(() => ({
      material: 'super-secret-value',
      materialHandle: 'memory://registry-read',
      fingerprintId: 'fp-registry-read',
    }));

    const denied = resolveCredential(
      {
        ref,
        scope,
        egressConfinementRequired: false,
        requiredAuditEvent: {
          type: 'CredentialUsePlanned',
          runId: 'run-123',
          taskId: 'task-456',
          operationId: 'operation-789',
          credentialRefIds: ['registry-read'],
          party: 'worker',
          phase: 'dependency-install',
          policyDigest: 'digest:policy-block',
          credentialRefDigest: 'digest:credential-refs',
          scopeDigest: 'digest:scope-block',
          attestationEventIds: [],
          evidenceRefs: [],
          prevEventHash: 'digest:previous',
          eventHash: 'digest:planned',
          at: '2026-06-22T10:00:30.000Z',
          egressPolicyId: 'egress-policy:none',
          expiresAt: '2026-06-22T10:02:00.000Z',
          reason: 'scoped injection required',
        },
        redactionSet: {
          id: 'redaction-set-1',
          credentialRefIds: ['registry-read'],
          labels: {
            'registry-read': '[REDACTED:credential:registry-read]',
          },
          fingerprintIds: ['fp-registry-read'],
          expiresAt: '2026-06-22T10:02:00.000Z',
        },
        injectionModes: ['env'],
      },
      {
        hashText,
        now: '2026-06-22T10:01:00.000Z',
        issuedAt: '2026-06-22T10:00:00.000Z',
        host: 'rubygems.org',
        command: 'pnpm install --frozen-lockfile',
        at: '2026-06-22T10:01:05.000Z',
        prevEventHash: 'digest:planned',
        auditSinkAvailable: true,
        resolveSecretMaterial,
      },
    );

    expect(denied).toMatchObject({
      ok: false,
      reason: 'credential-scope-denied',
    });
    expect(resolveSecretMaterial).not.toHaveBeenCalled();
  });
});
