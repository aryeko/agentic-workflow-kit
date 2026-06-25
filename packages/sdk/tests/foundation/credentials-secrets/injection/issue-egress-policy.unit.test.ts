import { describe, expect, it } from 'vitest';

import { issueEgressPolicy, resolveCredential } from '../../../../src/index.js';
import { egressSource, hashText, ref, scope, createPositiveAttestation } from './resolve-credential.test-helpers.js';

const forgeRef = {
  id: 'forge-primary',
  kind: 'forge' as const,
  purpose: 'push to remote',
  secret: {
    id: 'secret-ref:digest:{"key":"GITHUB_TOKEN","source":"env"}',
    source: 'env' as const,
    key: 'GITHUB_TOKEN',
  },
  allowedParties: ['runner'] as const,
  allowedPhases: ['push'] as const,
  allowedHosts: ['github.com'] as const,
  ttlSeconds: 120,
  policyDigest: 'digest:forge-policy',
};

describe('fnd-04-s2 issue egress policy', () => {
  it('issues a default-deny EgressPolicy with rules, negative probes, required attesters, freshness key, expiry, and digest', () => {
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

    expect(policy).toEqual({
      ok: true,
      value: {
        id: expect.any(String),
        runId: 'run-123',
        operationId: 'operation-789',
        audience: 'worker',
        egressPolicyDigest: expect.any(String),
        defaultAction: 'deny',
        rules: [
          {
            credentialRefIds: ['registry-read'],
            protocols: ['https'],
            hosts: ['registry.npmjs.org'],
            ports: [443],
            phase: 'dependency-install',
            purpose: 'install private packages',
          },
        ],
        negativeProbes: [
          {
            host: 'github.com',
            protocol: 'https',
            expected: 'blocked',
            reason: 'non-registry egress denied',
          },
        ],
        requiredAttesters: [
          {
            point: 'execution-host',
            capability: 'egress-confinement',
            driverId: 'local-host',
            scopeDigest: expect.any(String),
            egressPolicyDigest: expect.any(String),
          },
        ],
        negativeProbeIds: [expect.any(String)],
        freshnessKey: expect.any(String),
        expiresAt: '2026-06-22T10:02:00.000Z',
      },
    });
    if (policy.ok) {
      expect(Object.keys(policy.value.requiredAttesters[0] ?? {})).toEqual([
        'point',
        'capability',
        'driverId',
        'scopeDigest',
        'egressPolicyDigest',
      ]);
    }
  });

  it('deduplicates duplicate credential refs when deriving the egress freshness key inputs', () => {
    const policy = issueEgressPolicy(
      {
        refs: [ref, ref],
        scope,
        egressSource,
      },
      {
        hashText,
        at: '2026-06-22T10:00:30.000Z',
        prevEventHash: 'digest:previous',
      },
    );

    expect(policy.ok).toBe(true);
    expect(policy.value.freshnessKey).toContain('"credentialRefIds":["registry-read"]');
  });

  it('denies worker Forge scopes when issuing a public egress policy', () => {
    const policy = issueEgressPolicy(
      {
        refs: [forgeRef],
        scope: {
          ...scope,
          phase: 'push',
          commandPrefix: 'git push ',
        },
        egressSource: {
          defaultAction: 'deny',
          rules: [
            {
              credentialRefIds: ['forge-primary'],
              protocols: ['https'],
              hosts: ['github.com'],
              phase: 'push',
              purpose: 'push to remote',
            },
          ],
          negativeProbes: [],
          requiredAttesters: [
            {
              point: 'execution-host',
              capability: 'egress-confinement',
              driverId: 'local-host',
            },
          ],
        },
      },
      {
        hashText,
        at: '2026-06-22T10:00:30.000Z',
        prevEventHash: 'digest:previous',
      },
    );

    expect(policy).toMatchObject({
      ok: false,
      reason: 'worker-forge-credential-denied',
      auditEvent: {
        type: 'CredentialUseDenied',
        reason: 'worker-forge-credential-denied',
      },
    });
  });

  it.each([
    [
      'the runner scope phase is outside the Forge ref policy',
      {
        scope: {
          ...scope,
          party: 'runner' as const,
          phase: 'review-metadata',
          commandPrefix: 'gh pr view ',
        },
        egressSource: {
          defaultAction: 'deny' as const,
          rules: [
            {
              credentialRefIds: ['forge-primary'],
              protocols: ['https'] as const,
              hosts: ['github.com'],
              phase: 'review-metadata',
              purpose: 'read review metadata',
            },
          ],
          negativeProbes: [],
          requiredAttesters: [
            {
              point: 'execution-host' as const,
              capability: 'egress-confinement' as const,
              driverId: 'local-host',
            },
          ],
        },
        expectedReason: 'phase-not-allowed',
      },
    ],
    [
      'the runner Forge egress rule targets a host outside the configured allowlist',
      {
        scope: {
          ...scope,
          party: 'runner' as const,
          phase: 'push',
          commandPrefix: 'git push ',
        },
        egressSource: {
          defaultAction: 'deny' as const,
          rules: [
            {
              credentialRefIds: ['forge-primary'],
              protocols: ['https'] as const,
              hosts: ['gitlab.com'],
              phase: 'push',
              purpose: 'push to remote',
            },
          ],
          negativeProbes: [],
          requiredAttesters: [
            {
              point: 'execution-host' as const,
              capability: 'egress-confinement' as const,
              driverId: 'local-host',
            },
          ],
        },
        expectedReason: 'host-not-allowed',
      },
    ],
  ])('denies runner Forge issuance when %s', (_label, fixture) => {
    const policy = issueEgressPolicy(
      {
        refs: [forgeRef],
        scope: fixture.scope,
        egressSource: fixture.egressSource,
      },
      {
        hashText,
        at: '2026-06-22T10:00:30.000Z',
        prevEventHash: 'digest:previous',
      },
    );

    expect(policy).toMatchObject({
      ok: false,
      reason: 'credential-scope-denied',
      auditEvent: {
        type: 'CredentialUseDenied',
        reason: 'credential-scope-denied',
      },
    });
    if (policy.ok) {
      return;
    }

    expect(policy.auditEvent.scopeDigest).toBeDefined();
    expect(policy.auditEvent.reason).toBe('credential-scope-denied');
    expect(fixture.expectedReason).toBeTruthy();
  });

  it('retains every configured required attester and denies release when an attester has no matching attestation evidence', () => {
    const policy = issueEgressPolicy(
      {
        refs: [ref],
        scope,
        egressSource: {
          ...egressSource,
          requiredAttesters: [
            ...egressSource.requiredAttesters,
            {
              point: 'execution-host',
              capability: 'egress-confinement',
              driverId: 'missing-runtime',
            },
          ],
        },
      },
      {
        hashText,
        at: '2026-06-22T10:00:30.000Z',
        prevEventHash: 'digest:previous',
      },
    );

    expect(policy.ok).toBe(true);
    if (!policy.ok) {
      return;
    }

    expect(policy.value.requiredAttesters).toEqual([
      expect.objectContaining({
        point: 'execution-host',
        capability: 'egress-confinement',
        driverId: 'local-host',
      }),
      expect.objectContaining({
        point: 'execution-host',
        capability: 'egress-confinement',
        driverId: 'missing-runtime',
      }),
    ]);
    for (const attester of policy.value.requiredAttesters) {
      expect(Object.keys(attester)).toEqual(['point', 'capability', 'driverId', 'scopeDigest', 'egressPolicyDigest']);
    }

    const denied = resolveCredential(
      {
        ref,
        scope,
        egressConfinementRequired: true,
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
          scopeDigest: policy.value.requiredAttesters[0]?.scopeDigest ?? 'digest:scope-block',
          grantEventId: 'grant-123',
          attestationEventIds: [],
          evidenceRefs: [],
          prevEventHash: 'digest:previous',
          eventHash: 'digest:planned',
          at: '2026-06-22T10:00:30.000Z',
          egressPolicyId: policy.value.id,
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
        egressPolicy: policy.value,
        injectionModes: ['env'],
        attestations: [createPositiveAttestation(policy)],
        attestationIds: ['attestation-1'],
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

    expect(denied).toMatchObject({
      ok: false,
      reason: 'egress-policy-unattested',
    });
  });
});
