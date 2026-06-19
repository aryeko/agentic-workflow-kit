import type { ArtifactRef } from '@kit-vnext/foundation-fnd-02';
import { z } from 'zod';

export type { ArtifactRef } from '@kit-vnext/foundation-fnd-02';

export const ATTESTATION_FAILURE_TOKENS = [
  'attestation-stale',
  'attestation-absent',
  'attestation-negative',
  'evidence-missing',
] as const;

export type AttestationFailureToken = (typeof ATTESTATION_FAILURE_TOKENS)[number];

export interface InjectedClock {
  nowEpochMs(): number;
}

export type AttestationFreshness =
  | {
      readonly status: 'fresh';
      readonly capabilityPresent: true;
    }
  | {
      readonly status: 'stale';
      readonly token: 'attestation-stale';
      readonly capabilityPresent: false;
    };

export type CapabilityGateResult =
  | {
      readonly allowed: true;
      readonly attestation: CapabilityAttestation;
    }
  | {
      readonly allowed: false;
      readonly token: Extract<
        AttestationFailureToken,
        'attestation-stale' | 'attestation-absent' | 'attestation-negative'
      >;
    };

const isoDate = z.string().datetime({ offset: true });
const scopeValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

const artifactRefSchema: z.ZodType<ArtifactRef> = z.object({
  id: z.string().min(1),
  digest: z.string().min(1),
  size: z.number().int().nonnegative(),
  mediaType: z.string().min(1),
  retentionClass: z.string().min(1),
  classification: z.string().min(1),
  redactionState: z.enum(['raw', 'redacted', 'tombstoned']),
});

export const capabilityAttestationSchema = z
  .object({
    capability: z.string().min(1),
    probeMethod: z.string().min(1),
    result: z.enum(['positive', 'negative']),
    evidenceRef: artifactRefSchema,
    scope: z.record(z.string().min(1), scopeValueSchema),
    expiry: isoDate,
    driverVersion: z.string().min(1),
    platform: z.string().min(1),
    freshnessKey: z.string().min(1),
    at: isoDate,
    details: z
      .object({
        containmentStrength: z.string().min(1).optional(),
        negativeProbeResults: z.array(z.record(z.string().min(1), scopeValueSchema)).optional(),
        egressPolicyDigest: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type CapabilityAttestation = z.infer<typeof capabilityAttestationSchema>;

export const evaluateCapabilityFreshness = (
  attestation: CapabilityAttestation,
  clock: InjectedClock,
): AttestationFreshness => {
  const expiryMs = Date.parse(attestation.expiry);
  const nowMs = clock.nowEpochMs();

  if (!Number.isFinite(expiryMs) || expiryMs < nowMs) {
    return {
      status: 'stale',
      token: 'attestation-stale',
      capabilityPresent: false,
    };
  }

  return {
    status: 'fresh',
    capabilityPresent: true,
  };
};

export const evaluateCapabilityGate = (
  attestations: readonly CapabilityAttestation[],
  capability: string,
  clock: InjectedClock,
): CapabilityGateResult => {
  const attestation = latestAttestationForCapability(attestations, capability);

  if (!attestation) {
    return {
      allowed: false,
      token: 'attestation-absent',
    };
  }

  const freshness = evaluateCapabilityFreshness(attestation, clock);
  if (freshness.status === 'stale') {
    return {
      allowed: false,
      token: freshness.token,
    };
  }

  if (attestation.result === 'negative') {
    return {
      allowed: false,
      token: 'attestation-negative',
    };
  }

  return {
    allowed: true,
    attestation,
  };
};

const latestAttestationForCapability = (
  attestations: readonly CapabilityAttestation[],
  capability: string,
): CapabilityAttestation | undefined =>
  attestations
    .filter((attestation) => attestation.capability === capability)
    .reduce<CapabilityAttestation | undefined>((latest, attestation) => {
      if (!latest) {
        return attestation;
      }

      return Date.parse(attestation.at) > Date.parse(latest.at) ? attestation : latest;
    }, undefined);
