import type { CapabilityAttestation, CapabilityAttestationResult } from './types.js';

type SchemaSuccess<T> = {
  readonly success: true;
  readonly data: T;
};

type SchemaFailure = {
  readonly success: false;
  readonly error: Error;
};

type SchemaResult<T> = SchemaSuccess<T> | SchemaFailure;

export interface CapabilityAttestationSchema {
  readonly parse: (input: unknown) => CapabilityAttestation;
  readonly safeParse: (input: unknown) => SchemaResult<CapabilityAttestation>;
}

const capabilityAttestationResults = ['positive', 'negative'] as const satisfies readonly CapabilityAttestationResult[];

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isStringRecord = (value: unknown): value is Record<string, unknown> => isPlainObject(value);

const requiredStringFields = [
  'capability',
  'probeMethod',
  'result',
  'evidenceRef',
  'scope',
  'expiry',
  'driverVersion',
  'platform',
  'freshnessKey',
  'at',
] as const;

const validateCapabilityAttestation = (input: unknown): CapabilityAttestation => {
  if (!isPlainObject(input)) {
    throw new TypeError('Capability attestation must be a plain object.');
  }

  for (const field of requiredStringFields) {
    if (typeof input[field] !== 'string' || input[field].length === 0) {
      throw new TypeError(`Capability attestation field "${field}" must be a non-empty string.`);
    }
  }

  if (!capabilityAttestationResults.includes(input.result as CapabilityAttestationResult)) {
    throw new TypeError('Capability attestation result must be "positive" or "negative".');
  }

  if (input.details !== undefined && !isStringRecord(input.details)) {
    throw new TypeError('Capability attestation details must be a record when provided.');
  }

  const capability = input.capability as string;
  const probeMethod = input.probeMethod as string;
  const evidenceRef = input.evidenceRef as string;
  const scope = input.scope as string;
  const expiry = input.expiry as string;
  const driverVersion = input.driverVersion as string;
  const platform = input.platform as string;
  const freshnessKey = input.freshnessKey as string;
  const at = input.at as string;

  return {
    capability,
    probeMethod,
    result: input.result as CapabilityAttestationResult,
    evidenceRef,
    scope,
    expiry,
    driverVersion,
    platform,
    freshnessKey,
    at,
    ...(input.details === undefined ? {} : { details: input.details }),
  };
};

export const capabilityAttestationSchema: CapabilityAttestationSchema = {
  parse: (input) => validateCapabilityAttestation(input),
  safeParse: (input) => {
    try {
      return { success: true, data: validateCapabilityAttestation(input) };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error('Capability attestation validation failed.'),
      };
    }
  },
};
