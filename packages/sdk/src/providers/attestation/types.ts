export type CapabilityProvider = 'agent' | 'executionHost' | 'forge' | 'workSource';

export type CapabilityAttestationResult = 'positive' | 'negative';

export interface CapabilityAttestation<Capability extends string = string> {
  readonly capability: Capability;
  readonly probeMethod: string;
  readonly result: CapabilityAttestationResult;
  readonly evidenceRef: string;
  readonly scope: string;
  readonly expiry: string;
  readonly driverVersion: string;
  readonly platform: string;
  readonly freshnessKey: string;
  readonly at: string;
  readonly details?: Record<string, unknown>;
}
