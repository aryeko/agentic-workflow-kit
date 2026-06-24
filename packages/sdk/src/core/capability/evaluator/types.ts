import type { CapabilityId, CapabilityMode } from '../registry/index.js';

export const capabilityGateRecordSchema = 'kit-vnext.capability-gate-record.v1' as const;

export type GateDecision = 'allow' | 'deny';

export type ProviderDomain = 'Agent' | 'Forge' | 'Work Source' | 'Execution Host';

export interface CapabilityProviderScope {
  readonly provider: ProviderDomain;
  readonly scope: string;
  readonly freshnessKey: string;
  readonly approvedParentScopes?: readonly string[];
}

export interface CapabilityGateScope {
  readonly runId: string;
  readonly taskId?: string;
  readonly operationId: string;
  readonly providerScopes: readonly CapabilityProviderScope[];
  readonly repoRef?: string;
  readonly workspaceRef?: string;
  readonly sessionId?: string;
  readonly pullRequestRef?: string;
  readonly expectedHeadSha?: string;
  readonly egressPolicyDigest?: string;
}

export interface CapabilityGatePolicyDecision {
  readonly policyRef: string;
  readonly permits: boolean;
  readonly denialReason?: string;
}

export interface AttestationRef {
  readonly eventId: string;
  readonly provider: ProviderDomain;
  readonly capability: string;
  readonly evidenceRef: string;
  readonly freshnessKey: string;
  readonly scope: string;
  readonly expiry: string;
}

export interface GuaranteeEvaluation {
  readonly guaranteeId: string;
  readonly passed: boolean;
  readonly attestationRefs: readonly AttestationRef[];
  readonly evidenceRefs: readonly string[];
  readonly failureReason?: CapabilityGateFailureReason;
}

export interface CapabilityGateRequest {
  readonly gateId: string;
  readonly runId: string;
  readonly capability: CapabilityId;
  readonly mode: CapabilityMode;
  readonly scope: CapabilityGateScope;
  readonly policyRef: string;
  readonly policyDecision: CapabilityGatePolicyDecision;
  readonly requestedByDomain: string;
  readonly requestedAction: string;
  readonly evaluatedAt: string;
  readonly evidenceRefs: readonly string[];
}

export interface CapabilityGateRecordPayload {
  readonly schema: typeof capabilityGateRecordSchema;
  readonly gateId: string;
  readonly capability: CapabilityId;
  readonly decision: GateDecision;
  readonly mode: CapabilityMode;
  readonly scope: CapabilityGateScope;
  readonly policyRef: string;
  readonly requestedByDomain: string;
  readonly requestedAction: string;
  readonly evaluatedAt: string;
  readonly evaluatedGuarantees: readonly GuaranteeEvaluation[];
  readonly attestationRefs: readonly AttestationRef[];
  readonly evidenceRefs: readonly string[];
  readonly failureReason?: CapabilityGateFailureReason;
}

export type CapabilityGateFailureReason =
  | 'mode-disallows-capability'
  | 'policy-disallows-capability'
  | 'capability-deferred'
  | 'run-log-degraded'
  | 'required-evidence-absent'
  | 'required-evidence-ambiguous'
  | 'attestation-absent'
  | 'attestation-stale'
  | 'attestation-negative'
  | 'attestation-out-of-scope'
  | 'attestation-contradictory'
  | 'attestation-non-replayable'
  | 'self-report-only'
  | 'gate-record-unwritable';
