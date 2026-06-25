import { describe, expect, it } from 'vitest';

import { planInjection, resolveCredential, type EgressAttestation } from '../../../src/index.js';
import { egressSource, hashText, planDependencies, ref, scope } from './injection/resolve-credential.test-helpers.js';

/**
 * fnd-04-r1 finding #7 — narrowing the release-match to identity + freshness must
 * NOT weaken denial. A genuine `egressPolicyDigest` mismatch still fails closed as
 * `egress-policy-unattested`, even when the Host-reported platform/driverVersion
 * happen to look correct.
 */

const buildPlan = () => {
  const planned = planInjection(
    {
      refs: [ref],
      scope,
      bindingTemplates: [{ credentialRefId: 'registry-read', mode: 'env', nameOrPath: 'NPM_TOKEN' }],
      egressSource,
    },
    planDependencies,
  );
  if (!planned.ok) {
    throw new Error('Expected injection plan to succeed.');
  }
  return planned;
};

const baseAttestation = (planned: ReturnType<typeof buildPlan>): EgressAttestation => {
  const requiredAttester = planned.egressPolicy.requiredAttesters[0];
  if (requiredAttester === undefined) {
    throw new Error('Expected a required attester.');
  }
  return {
    id: 'attestation-1',
    point: requiredAttester.point,
    capability: 'egress-confinement',
    driverId: requiredAttester.driverId,
    scopeDigest: requiredAttester.scopeDigest,
    egressPolicyDigest: requiredAttester.egressPolicyDigest,
    freshnessKey: planned.egressPolicy.freshnessKey,
    platform: 'darwin',
    driverVersion: '1.0.0',
    expiresAt: '2026-06-22T10:02:30.000Z',
    evidenceRef: 'evidence://attestation-1',
    negativeProbeIds: [...planned.egressPolicy.negativeProbeIds],
    result: 'positive',
  };
};

const release = (planned: ReturnType<typeof buildPlan>, attestation: EgressAttestation) =>
  resolveCredential(
    {
      ref,
      scope,
      egressConfinementRequired: true,
      requiredAuditEvent: planned.requiredAuditEvent,
      redactionSet: planned.redactionSet,
      egressPolicy: planned.egressPolicy,
      injectionModes: planned.bindings.map((binding) => binding.mode),
      attestations: [attestation],
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

describe('fnd-04-r1 release-match still denies genuine mismatch', () => {
  it('denies a mismatched egressPolicyDigest as egress-policy-unattested', () => {
    const planned = buildPlan();
    const denied = release(planned, {
      ...baseAttestation(planned),
      egressPolicyDigest: 'digest:wrong-egress-policy',
    });

    expect(denied).toMatchObject({
      ok: false,
      reason: 'egress-policy-unattested',
      auditEvent: { type: 'CredentialUseDenied', reason: 'egress-policy-unattested' },
    });
  });

  it('denies a stale attestation even when identity matches', () => {
    const planned = buildPlan();
    const denied = release(planned, {
      ...baseAttestation(planned),
      expiresAt: '2026-06-22T10:00:30.000Z',
    });

    expect(denied).toMatchObject({ ok: false, reason: 'egress-policy-unattested' });
  });
});
