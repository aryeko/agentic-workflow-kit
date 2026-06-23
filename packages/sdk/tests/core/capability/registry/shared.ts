import type {
  CapabilityId,
  CapabilityMode,
  CapabilityRegistryDenialToken,
  GuaranteeRequirementId,
} from '../../../../src/index.js';

export const expectedCapabilityIds = [
  'auto-merge',
  'auto-recover',
  'unattended-run',
  'escalation-auto-grant',
  'orchestrator-decide',
] as const satisfies readonly CapabilityId[];

export const expectedCapabilityModes = ['manual', 'assisted'] as const satisfies readonly CapabilityMode[];

export const expectedGuaranteeRequirementIds = [
  'assisted-mode-required',
  'policy-permits-capability',
  'replay-health-usable',
  'recorded-evidence-unambiguous-not-self-report',
  'attestations-fresh-positive-in-scope-non-contradictory-replayable',
] as const satisfies readonly GuaranteeRequirementId[];

export const expectedAutoMergeAttestations = [
  'canInspectProtection',
  'supportsRulesets',
  'supportsMergeQueue',
  'supportsStatusWrite',
] as const;

export const expectedAutoRecoverAttestations = [
  'canKill',
  'containmentStrength',
  'preservesHostProcessParentage',
] as const;

export const expectedUnattendedRunAttestations = [
  'supportsClaim',
  'canKill',
  'containmentStrength',
  'egress-confinement',
  'preservesHostProcessParentage',
] as const;

export const expectedEscalationAttestations = [
  'canRelayApproval',
  'canPersistApprovalAnswerChannel',
  'egress-confinement',
] as const;

export const expectedContainmentFloor = ['process-group', 'kernel-tree', 'job-object'] as const;

export const expectedDenialTokens = [
  'mode-disallows-capability',
  'policy-disallows-capability',
  'capability-deferred',
] as const satisfies readonly CapabilityRegistryDenialToken[];

export const assertNever = (_value: never): never => {
  throw new Error('unreachable');
};
