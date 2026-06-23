import { deepFreeze } from './deep-freeze.js';
import type { GuaranteeRequirementId } from './guarantee-requirements.js';
import { guaranteeRequirementCatalog } from './guarantee-requirements.js';
import type {
  ActivePostureEntry,
  AutoMergeAttestations,
  AutoRecoverAttestations,
  ContainmentPostureEntry,
  DeferredPostureEntry,
  EscalationAutoGrantAttestations,
  UnattendedRunAttestations,
} from './posture-entry.js';

export const capabilityContainmentFloor = deepFreeze(['process-group', 'kernel-tree', 'job-object'] as const);

type SharedGuarantees = typeof guaranteeRequirementCatalog;

type AutoMergePostureEntry = ActivePostureEntry<AutoMergeAttestations> & {
  readonly requiredGuaranteeIds: SharedGuarantees;
};

type AutoRecoverPostureEntry = ContainmentPostureEntry<AutoRecoverAttestations> & {
  readonly requiredGuaranteeIds: SharedGuarantees;
  readonly containmentFloor: typeof capabilityContainmentFloor;
};

type UnattendedRunPostureEntry = ContainmentPostureEntry<UnattendedRunAttestations> & {
  readonly requiredGuaranteeIds: SharedGuarantees;
  readonly containmentFloor: typeof capabilityContainmentFloor;
};

type EscalationAutoGrantPostureEntry = ActivePostureEntry<EscalationAutoGrantAttestations> & {
  readonly requiredGuaranteeIds: SharedGuarantees;
};

type CapabilityPostureCatalog = {
  readonly 'auto-merge': AutoMergePostureEntry;
  readonly 'auto-recover': AutoRecoverPostureEntry;
  readonly 'unattended-run': UnattendedRunPostureEntry;
  readonly 'escalation-auto-grant': EscalationAutoGrantPostureEntry;
  readonly 'orchestrator-decide': DeferredPostureEntry;
};

const sharedGuarantees = guaranteeRequirementCatalog satisfies readonly GuaranteeRequirementId[];

export const capabilityPostureCatalog = deepFreeze({
  'auto-merge': {
    status: 'assisted',
    allowedMode: ['assisted'],
    requiredGuaranteeIds: sharedGuarantees,
    requiredAttestations: ['canInspectProtection', 'supportsRulesets', 'supportsMergeQueue', 'supportsStatusWrite'],
  },
  'auto-recover': {
    status: 'assisted',
    allowedMode: ['assisted'],
    requiredGuaranteeIds: sharedGuarantees,
    requiredAttestations: ['canKill', 'containmentStrength', 'preservesHostProcessParentage'],
    containmentFloor: capabilityContainmentFloor,
  },
  'unattended-run': {
    status: 'assisted',
    allowedMode: ['assisted'],
    requiredGuaranteeIds: sharedGuarantees,
    requiredAttestations: [
      'supportsClaim',
      'canKill',
      'containmentStrength',
      'egress-confinement',
      'preservesHostProcessParentage',
    ],
    containmentFloor: capabilityContainmentFloor,
  },
  'escalation-auto-grant': {
    status: 'assisted',
    allowedMode: ['assisted'],
    requiredGuaranteeIds: sharedGuarantees,
    requiredAttestations: ['canRelayApproval', 'canPersistApprovalAnswerChannel', 'egress-confinement'],
  },
  'orchestrator-decide': {
    status: 'deferred',
    allowedMode: [],
    requiredGuaranteeIds: [],
    requiredAttestations: [],
    denialToken: 'capability-deferred',
  },
} as const satisfies CapabilityPostureCatalog);
