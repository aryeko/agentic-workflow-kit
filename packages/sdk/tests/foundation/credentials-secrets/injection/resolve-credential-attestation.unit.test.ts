import { describe, expect, it, vi } from 'vitest';

import { planInjection, resolveCredential, type EgressAttestation } from '../../../../src/index.js';
import {
  createPositiveAttestation,
  egressSource,
  hashText,
  planDependencies,
  ref,
  scope,
} from './resolve-credential.test-helpers.js';

describe('fnd-04-s2 resolve credential attestation requirements', () => {
  it('fails release as egress-policy-unattested unless fresh positive matching attestation evidence is supplied by id', () => {
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

    const denied = resolveCredential(
      {
        ref,
        scope,
        requiredAuditEvent: planned.requiredAuditEvent,
        redactionSet: planned.redactionSet,
        egressPolicy: planned.egressPolicy,
        injectionModes: planned.bindings.map((binding) => binding.mode),
        attestations: [],
        attestationIds: [],
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
        resolveSecretMaterial: vi.fn(() => ({
          material: 'super-secret-value',
          materialHandle: 'memory://registry-read',
          fingerprintId: 'fp-registry-read',
        })),
      },
    );

    const positiveAttestation = createPositiveAttestation({ ok: true, value: planned.egressPolicy });
    const allowed = resolveCredential(
      {
        ref,
        scope,
        requiredAuditEvent: planned.requiredAuditEvent,
        redactionSet: planned.redactionSet,
        egressPolicy: planned.egressPolicy,
        injectionModes: planned.bindings.map((binding) => binding.mode),
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
      auditEvent: {
        type: 'CredentialUseDenied',
        reason: 'egress-policy-unattested',
      },
    });
    expect(allowed).toEqual({
      ok: true,
      credentialRefId: 'registry-read',
      materialHandle: 'memory://registry-read',
      redactionSet: planned.redactionSet,
      auditEvent: expect.objectContaining({
        type: 'CredentialUseStarted',
        credentialRefIds: ['registry-read'],
        operationId: 'operation-789',
        attestationEventIds: ['attestation-1'],
        evidenceRefs: ['evidence://attestation-1'],
      }),
    });
  });

  it.each([
    [
      'evidence ref is empty',
      (attestation: EgressAttestation) => ({
        ...attestation,
        evidenceRef: '   ',
      }),
    ],
    [
      'negative probe coverage is missing entirely',
      (attestation: EgressAttestation) => ({
        ...attestation,
        negativeProbeIds: [],
      }),
    ],
    [
      'negative probe coverage is partial',
      (attestation: EgressAttestation) => ({
        ...attestation,
        negativeProbeIds: attestation.negativeProbeIds.slice(0, -1),
      }),
    ],
  ])('denies release when %s', (_label, mutateAttestation) => {
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
        egressSource: {
          ...egressSource,
          negativeProbes: [
            ...egressSource.negativeProbes,
            {
              host: 'gitlab.com',
              protocol: 'https',
              expected: 'blocked',
              reason: 'secondary probe coverage required',
            },
          ],
        },
      },
      planDependencies,
    );

    expect(planned.ok).toBe(true);
    if (!planned.ok) {
      return;
    }

    const denied = resolveCredential(
      {
        ref,
        scope,
        requiredAuditEvent: planned.requiredAuditEvent,
        redactionSet: planned.redactionSet,
        egressPolicy: planned.egressPolicy,
        injectionModes: planned.bindings.map((binding) => binding.mode),
        attestations: [mutateAttestation(createPositiveAttestation({ ok: true, value: planned.egressPolicy }))],
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

  it('treats mismatched attestation driver ids as unattested evidence', () => {
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

    const denied = resolveCredential(
      {
        ref,
        scope,
        requiredAuditEvent: planned.requiredAuditEvent,
        redactionSet: planned.redactionSet,
        egressPolicy: planned.egressPolicy,
        injectionModes: ['env'],
        attestations: [
          {
            id: 'attestation-2',
            point: 'execution-host',
            capability: 'egress-confinement',
            driverId: 'other-host',
            scopeDigest: planned.requiredAuditEvent.scopeDigest,
            egressPolicyDigest: planned.egressPolicy.egressPolicyDigest,
            freshnessKey: planned.egressPolicy.freshnessKey,
            platform: 'darwin',
            driverVersion: '1.0.0',
            expiresAt: '2026-06-22T10:02:30.000Z',
            evidenceRef: 'evidence://attestation-2',
            negativeProbeIds: ['probe-2'],
            result: 'positive',
          },
        ],
        attestationIds: ['attestation-2'],
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
