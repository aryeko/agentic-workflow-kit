import type { AgentCapability } from '../../../providers/agent/index.js';
import type { ContainmentStrength, HostCapability } from '../../../providers/execution-host/index.js';
import type { ForgeCapability } from '../../../providers/forge/index.js';
import type { WorkSourceCapability } from '../../../providers/work-source/index.js';
import type { CapabilityMode } from './capability-mode.js';
import type { GuaranteeRequirementId } from './guarantee-requirements.js';

export type CapabilityAttestationLiteral = AgentCapability | ForgeCapability | WorkSourceCapability | HostCapability;

export type AllowedContainmentStrength = Exclude<ContainmentStrength, 'none'>;

type AssistedAllowedMode = readonly [Extract<CapabilityMode, 'assisted'>];
type DeferredAllowedMode = readonly [];
type DeferredRequirementIds = readonly [];
type DeferredAttestations = readonly [];

export type AutoMergeAttestations = readonly [
  Extract<ForgeCapability, 'canInspectProtection'>,
  Extract<ForgeCapability, 'supportsRulesets'>,
  Extract<ForgeCapability, 'supportsMergeQueue'>,
  Extract<WorkSourceCapability, 'supportsStatusWrite'>,
];

export type AutoRecoverAttestations = readonly [
  Extract<HostCapability, 'canKill'>,
  Extract<HostCapability, 'containmentStrength'>,
  Extract<AgentCapability, 'preservesHostProcessParentage'>,
];

export type UnattendedRunAttestations = readonly [
  Extract<WorkSourceCapability, 'supportsClaim'>,
  Extract<HostCapability, 'canKill'>,
  Extract<HostCapability, 'containmentStrength'>,
  Extract<HostCapability, 'egress-confinement'>,
  Extract<AgentCapability, 'preservesHostProcessParentage'>,
];

export type EscalationAutoGrantAttestations = readonly [
  Extract<AgentCapability, 'canRelayApproval'>,
  Extract<AgentCapability, 'canPersistApprovalAnswerChannel'>,
  Extract<HostCapability, 'egress-confinement'>,
];

type SharedGuarantees = readonly GuaranteeRequirementId[];

export type ActivePostureEntry<Attestations extends readonly CapabilityAttestationLiteral[]> = {
  readonly status: 'assisted';
  readonly allowedMode: AssistedAllowedMode;
  readonly requiredGuaranteeIds: SharedGuarantees;
  readonly requiredAttestations: Attestations;
  readonly denialToken?: never;
};

export type ContainmentPostureEntry<Attestations extends readonly CapabilityAttestationLiteral[]> =
  ActivePostureEntry<Attestations> & {
    readonly containmentFloor: readonly AllowedContainmentStrength[];
  };

export type DeferredPostureEntry = {
  readonly status: 'deferred';
  readonly allowedMode: DeferredAllowedMode;
  readonly requiredGuaranteeIds: DeferredRequirementIds;
  readonly requiredAttestations: DeferredAttestations;
  readonly denialToken: 'capability-deferred';
  readonly containmentFloor?: never;
};

export type PostureEntry =
  | ActivePostureEntry<AutoMergeAttestations>
  | ContainmentPostureEntry<AutoRecoverAttestations>
  | ContainmentPostureEntry<UnattendedRunAttestations>
  | ActivePostureEntry<EscalationAutoGrantAttestations>
  | DeferredPostureEntry;
