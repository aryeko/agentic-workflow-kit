import type { CapabilityAttestation, CapabilityAttestationResult, CapabilityProvider } from '../../../src/index.js';

const validAttestation = {
  capability: 'canKill',
  probeMethod: 'live-smoke',
  result: 'positive',
  evidenceRef: 'artifact://attestation',
  scope: 'worker',
  expiry: '2026-06-22T12:00:00.000Z',
  driverVersion: '1.2.3',
  platform: 'darwin-arm64',
  freshnessKey: 'driver@1.2.3:worker',
  at: '2026-06-22T11:00:00.000Z',
  details: { source: 'test' },
} satisfies CapabilityAttestation<'canKill'>;

const capabilityProviders = ['agent', 'executionHost', 'forge', 'workSource'] satisfies readonly CapabilityProvider[];
const capabilityAttestationResults = ['positive', 'negative'] satisfies readonly CapabilityAttestationResult[];

void capabilityProviders;
void capabilityAttestationResults;
void validAttestation;

// @ts-expect-error AC-1 requires capability.
const missingCapability: CapabilityAttestation<'canKill'> = {
  probeMethod: validAttestation.probeMethod,
  result: validAttestation.result,
  evidenceRef: validAttestation.evidenceRef,
  scope: validAttestation.scope,
  expiry: validAttestation.expiry,
  driverVersion: validAttestation.driverVersion,
  platform: validAttestation.platform,
  freshnessKey: validAttestation.freshnessKey,
  at: validAttestation.at,
  details: validAttestation.details,
};

// @ts-expect-error AC-1 requires probeMethod.
const missingProbeMethod: CapabilityAttestation<'canKill'> = {
  capability: validAttestation.capability,
  result: validAttestation.result,
  evidenceRef: validAttestation.evidenceRef,
  scope: validAttestation.scope,
  expiry: validAttestation.expiry,
  driverVersion: validAttestation.driverVersion,
  platform: validAttestation.platform,
  freshnessKey: validAttestation.freshnessKey,
  at: validAttestation.at,
  details: validAttestation.details,
};

// @ts-expect-error AC-1 requires result.
const missingResult: CapabilityAttestation<'canKill'> = {
  capability: validAttestation.capability,
  probeMethod: validAttestation.probeMethod,
  evidenceRef: validAttestation.evidenceRef,
  scope: validAttestation.scope,
  expiry: validAttestation.expiry,
  driverVersion: validAttestation.driverVersion,
  platform: validAttestation.platform,
  freshnessKey: validAttestation.freshnessKey,
  at: validAttestation.at,
  details: validAttestation.details,
};

// @ts-expect-error AC-1 requires evidenceRef.
const missingEvidenceRef: CapabilityAttestation<'canKill'> = {
  capability: validAttestation.capability,
  probeMethod: validAttestation.probeMethod,
  result: validAttestation.result,
  scope: validAttestation.scope,
  expiry: validAttestation.expiry,
  driverVersion: validAttestation.driverVersion,
  platform: validAttestation.platform,
  freshnessKey: validAttestation.freshnessKey,
  at: validAttestation.at,
  details: validAttestation.details,
};

// @ts-expect-error AC-1 requires scope.
const missingScope: CapabilityAttestation<'canKill'> = {
  capability: validAttestation.capability,
  probeMethod: validAttestation.probeMethod,
  result: validAttestation.result,
  evidenceRef: validAttestation.evidenceRef,
  expiry: validAttestation.expiry,
  driverVersion: validAttestation.driverVersion,
  platform: validAttestation.platform,
  freshnessKey: validAttestation.freshnessKey,
  at: validAttestation.at,
  details: validAttestation.details,
};

// @ts-expect-error AC-1 requires expiry.
const missingExpiry: CapabilityAttestation<'canKill'> = {
  capability: validAttestation.capability,
  probeMethod: validAttestation.probeMethod,
  result: validAttestation.result,
  evidenceRef: validAttestation.evidenceRef,
  scope: validAttestation.scope,
  driverVersion: validAttestation.driverVersion,
  platform: validAttestation.platform,
  freshnessKey: validAttestation.freshnessKey,
  at: validAttestation.at,
  details: validAttestation.details,
};

// @ts-expect-error AC-1 requires driverVersion.
const missingDriverVersion: CapabilityAttestation<'canKill'> = {
  capability: validAttestation.capability,
  probeMethod: validAttestation.probeMethod,
  result: validAttestation.result,
  evidenceRef: validAttestation.evidenceRef,
  scope: validAttestation.scope,
  expiry: validAttestation.expiry,
  platform: validAttestation.platform,
  freshnessKey: validAttestation.freshnessKey,
  at: validAttestation.at,
  details: validAttestation.details,
};

// @ts-expect-error AC-1 requires platform.
const missingPlatform: CapabilityAttestation<'canKill'> = {
  capability: validAttestation.capability,
  probeMethod: validAttestation.probeMethod,
  result: validAttestation.result,
  evidenceRef: validAttestation.evidenceRef,
  scope: validAttestation.scope,
  expiry: validAttestation.expiry,
  driverVersion: validAttestation.driverVersion,
  freshnessKey: validAttestation.freshnessKey,
  at: validAttestation.at,
  details: validAttestation.details,
};

// @ts-expect-error AC-1 requires freshnessKey.
const missingFreshnessKey: CapabilityAttestation<'canKill'> = {
  capability: validAttestation.capability,
  probeMethod: validAttestation.probeMethod,
  result: validAttestation.result,
  evidenceRef: validAttestation.evidenceRef,
  scope: validAttestation.scope,
  expiry: validAttestation.expiry,
  driverVersion: validAttestation.driverVersion,
  platform: validAttestation.platform,
  at: validAttestation.at,
  details: validAttestation.details,
};

// @ts-expect-error AC-1 requires at.
const missingAt: CapabilityAttestation<'canKill'> = {
  capability: validAttestation.capability,
  probeMethod: validAttestation.probeMethod,
  result: validAttestation.result,
  evidenceRef: validAttestation.evidenceRef,
  scope: validAttestation.scope,
  expiry: validAttestation.expiry,
  driverVersion: validAttestation.driverVersion,
  platform: validAttestation.platform,
  freshnessKey: validAttestation.freshnessKey,
  details: validAttestation.details,
};

void missingCapability;
void missingProbeMethod;
void missingResult;
void missingEvidenceRef;
void missingScope;
void missingExpiry;
void missingDriverVersion;
void missingPlatform;
void missingFreshnessKey;
void missingAt;
