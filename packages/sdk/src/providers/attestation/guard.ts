import { capabilityAttestationSchema } from './schema.js';
import type { CapabilityAttestation } from './types.js';

export const isCapabilityAttestation = (input: unknown): input is CapabilityAttestation =>
  capabilityAttestationSchema.safeParse(input).success;
