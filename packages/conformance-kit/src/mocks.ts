import type { CapabilityAttestation } from './attestation.js';
import type { CapabilityProbeDriver } from './conformance.js';

export type AdversarialCapabilityMockVariant = 'omit' | 'delay' | 'lie';

export interface CapabilityMockOptions {
  readonly attestation: CapabilityAttestation;
  readonly elapsedMs: number;
}

export interface AdversarialCapabilityMockOptions extends CapabilityMockOptions {
  readonly omitField?: keyof CapabilityAttestation;
}

export const createConformantCapabilityMock = (options: CapabilityMockOptions): CapabilityProbeDriver => ({
  probeCapability: (capability) => ({
    payload: capability === options.attestation.capability ? options.attestation : undefined,
    elapsedMs: options.elapsedMs,
  }),
});

export const createAdversarialCapabilityMock = (
  variant: AdversarialCapabilityMockVariant,
  options: AdversarialCapabilityMockOptions,
): CapabilityProbeDriver => {
  const payload = payloadForVariant(variant, options);

  return {
    probeCapability: (capability) => ({
      payload: capability === options.attestation.capability ? payload : undefined,
      elapsedMs: options.elapsedMs,
    }),
  };
};

const payloadForVariant = (
  variant: AdversarialCapabilityMockVariant,
  options: AdversarialCapabilityMockOptions,
): unknown => {
  if (variant === 'omit') {
    return omitField(options.attestation, options.omitField ?? 'evidenceRef');
  }

  if (variant === 'lie') {
    return {
      ...options.attestation,
      result: 'negative',
    };
  }

  return options.attestation;
};

const omitField = <T extends Record<string, unknown>, K extends keyof T>(value: T, field: K): Omit<T, K> => {
  const { [field]: _omitted, ...rest } = value;
  return rest;
};
