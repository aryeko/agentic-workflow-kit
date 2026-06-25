import type { EnforcementPoint, RequiredAttester } from 'sdk';

/**
 * fnd-04-r1 finding #7 — `RequiredAttester` is the public fnd-04 shape and must
 * be exactly `{ point, capability, driverId, scopeDigest, egressPolicyDigest }`.
 *
 * `platform`, `driverVersion`, and `runtimeMetadataAvailable` are runtime facts
 * of the attesting Execution Host driver (matched at release time against the
 * Host `CapabilityAttestation`), NOT values fnd-04 can produce — so they must
 * not appear on `RequiredAttester`. This file is compiled by the `type:fixtures`
 * lane (via the sibling `tsconfig.public.json`); the `@ts-expect-error` lines
 * fail the lane if any of the dropped members are reintroduced.
 */

const point: EnforcementPoint = 'execution-host';

// Positive: the exact 5-member design shape must construct with zero tsc errors.
export const requiredAttester: RequiredAttester = {
  point,
  capability: 'egress-confinement',
  driverId: 'local-host',
  scopeDigest: 'digest:scope',
  egressPolicyDigest: 'digest:egress-policy',
};

// The five members are the entire structural surface of the type.
export const point2: RequiredAttester['point'] = requiredAttester.point;
export const capability2: RequiredAttester['capability'] = requiredAttester.capability;
export const driverId2: RequiredAttester['driverId'] = requiredAttester.driverId;
export const scopeDigest2: RequiredAttester['scopeDigest'] = requiredAttester.scopeDigest;
export const egressPolicyDigest2: RequiredAttester['egressPolicyDigest'] = requiredAttester.egressPolicyDigest;

// Negative: the three dropped members must not exist on the public shape.
export const fabricatedPlatform =
  // @ts-expect-error platform is a Host-reported runtime fact, not a RequiredAttester member
  requiredAttester.platform;

export const fabricatedDriverVersion =
  // @ts-expect-error driverVersion is a Host-reported runtime fact, not a RequiredAttester member
  requiredAttester.driverVersion;

export const fabricatedRuntimeMetadataAvailable =
  // @ts-expect-error runtimeMetadataAvailable was a fabrication, not a RequiredAttester member
  requiredAttester.runtimeMetadataAvailable;
