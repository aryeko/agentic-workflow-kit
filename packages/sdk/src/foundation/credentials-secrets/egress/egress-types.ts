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

export type RequiredAttester = RequiredAttesterSource & {
  readonly scopeDigest: string;
  readonly egressPolicyDigest: string;
  readonly platform: string;
  readonly driverVersion: string;
  readonly runtimeMetadataAvailable: boolean;
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

export type RequiredAttesterRuntime = {
  readonly driverId: string;
  readonly platform: string;
  readonly driverVersion: string;
};

export type IssueEgressPolicyInput = {
  readonly refs: readonly import('../refs/index.js').CredentialRef[];
  readonly scope: CredentialScope;
  readonly egressSource: EgressPolicySource;
  readonly requiredAttesters: readonly RequiredAttesterRuntime[];
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
