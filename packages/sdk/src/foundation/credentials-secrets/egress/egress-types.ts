import type {
  EgressPolicySource,
  EgressRuleSource,
  NegativeProbeSource,
  RequiredAttesterSource,
} from '../../configuration-policy/index.js';
import type { CredentialUseDenied } from '../audit/index.js';
import type { CredentialDenied } from '../failures/index.js';
import type { EnforcementPoint } from '../refs/index.js';
import type { CredentialScope } from '../scopes/index.js';

export type EgressRule = EgressRuleSource;

export type NegativeProbe = NegativeProbeSource;

// `point`, `capability`, and `driverId` come from the fnd-01 `RequiredAttesterSource`;
// `scopeDigest` and `egressPolicyDigest` are computed by fnd-04. `platform` and
// `driverVersion` are intentionally NOT declared here — they are runtime facts of the
// attesting Execution Host driver, matched at credential-release time against the Host
// `CapabilityAttestation`, not values config or fnd-04 can produce.
export type RequiredAttester = RequiredAttesterSource & {
  readonly scopeDigest: string;
  readonly egressPolicyDigest: string;
};

export type EgressPolicy = {
  readonly id: string;
  readonly runId: string;
  readonly operationId: string;
  readonly audience: CredentialScope['party'];
  readonly egressPolicyDigest: string;
  readonly defaultAction: 'deny';
  readonly rules: readonly EgressRule[];
  readonly negativeProbes: readonly NegativeProbe[];
  readonly negativeProbeIds: readonly string[];
  readonly requiredAttesters: readonly RequiredAttester[];
  readonly freshnessKey: string;
  readonly expiresAt: string;
};

export type IssuedEgressPolicy = {
  readonly ok: true;
  readonly value: EgressPolicy;
};

export type IssueEgressPolicyResult = IssuedEgressPolicy | CredentialDenied;

export type IssueEgressPolicyInput = {
  readonly refs: readonly import('../refs/index.js').CredentialRef[];
  readonly scope: CredentialScope;
  readonly egressSource: EgressPolicySource;
};

export type IssueEgressPolicyDependencies = {
  readonly hashText: (value: string) => string;
  readonly at: string;
  readonly prevEventHash: string;
};

export type EgressAttestation = {
  readonly id: string;
  readonly point: EnforcementPoint;
  readonly capability: 'egress-confinement';
  readonly driverId: string;
  readonly scopeDigest: string;
  readonly egressPolicyDigest: string;
  readonly freshnessKey: string;
  readonly platform: string;
  readonly driverVersion: string;
  readonly expiresAt: string;
  readonly evidenceRef: string;
  readonly negativeProbeIds: readonly string[];
  readonly result: 'positive' | 'negative';
};

export type MatchedEgressAttestation = {
  readonly attestationEventIds: readonly string[];
  readonly evidenceRefs: readonly string[];
};

export type EgressAttestationDenial = {
  readonly ok: false;
  readonly denial: CredentialDenied;
};

export type EgressAttestationMatch = MatchedEgressAttestation | EgressAttestationDenial;

export type CreateCredentialDeniedFromEgressInput = {
  readonly auditEvent: CredentialUseDenied;
};
