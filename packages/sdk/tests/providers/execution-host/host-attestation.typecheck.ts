import type { CapabilityAttestation, HostAttestationDetails, HostCapability } from '../../../src/index.js';

import { capabilityAttestationFixture, hostAttestationDetailsFixture } from './fixtures/shared.js';

const details = hostAttestationDetailsFixture() satisfies HostAttestationDetails;
const attestation = capabilityAttestationFixture({ details }) satisfies CapabilityAttestation<'containmentStrength'>;
const hostCapabilities = [
  'canKill',
  'containmentStrength',
  'emitsStructuredToolExit',
  'egress-confinement',
] satisfies readonly HostCapability[];

void details;
void attestation;
void hostCapabilities;

const invalidHostCapabilityAttestation: CapabilityAttestation<HostCapability> = {
  ...attestation,
  // @ts-expect-error AC-5 capability must be a HostCapability member.
  capability: 'canRelayApproval',
};

void invalidHostCapabilityAttestation;
