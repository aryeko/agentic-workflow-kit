import { describe, expect, it } from 'vitest';

import { planInjection, resolveCredential, type EgressAttestation } from '../../../src/index.js';
import { egressSource, hashText, planDependencies, ref, scope } from './injection/resolve-credential.test-helpers.js';

/**
 * fnd-04-r1 finding #7 — release-match is platform/version agnostic. The Host's
 * reported `platform`/`driverVersion` live on the `EgressAttestation` as evidence,
 * but they are NOT matched against the `RequiredAttester`. A fresh positive
 * `egress-confinement` attestation that matches `driverId` + `scopeDigest` +
 * `egressPolicyDigest` (plus freshness/probe coverage) must release the credential
 * even when the Host reports an arbitrary platform and driver version.
 */

describe('fnd-04-r1 release-match is platform/version agnostic', () => {
  it('releases the credential when driverId/scopeDigest/egressPolicyDigest match despite sentinel platform and driverVersion', () => {
    const planned = planInjection(
      {
        refs: [ref],
        scope,
        bindingTemplates: [{ credentialRefId: 'registry-read', mode: 'env', nameOrPath: 'NPM_TOKEN' }],
        egressSource,
      },
      planDependencies,
    );
    expect(planned.ok).toBe(true);
    if (!planned.ok) {
      return;
    }

    const requiredAttester = planned.egressPolicy.requiredAttesters[0];
    expect(requiredAttester).toBeDefined();
    if (requiredAttester === undefined) {
      return;
    }

    const attestation: EgressAttestation = {
      id: 'attestation-1',
      point: requiredAttester.point,
      capability: 'egress-confinement',
      driverId: requiredAttester.driverId,
      scopeDigest: requiredAttester.scopeDigest,
      egressPolicyDigest: requiredAttester.egressPolicyDigest,
      freshnessKey: planned.egressPolicy.freshnessKey,
      // Sentinel Host-reported facts that intentionally do NOT match any fnd-04 value.
      platform: 'any-os',
      driverVersion: '9.9.9',
      expiresAt: '2026-06-22T10:02:30.000Z',
      evidenceRef: 'evidence://attestation-1',
      negativeProbeIds: [...planned.egressPolicy.negativeProbeIds],
      result: 'positive',
    };

    const released = resolveCredential(
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

    expect(released.ok).toBe(true);
    expect(released).toMatchObject({
      ok: true,
      credentialRefId: 'registry-read',
      auditEvent: { attestationEventIds: ['attestation-1'], evidenceRefs: ['evidence://attestation-1'] },
    });
  });
});
