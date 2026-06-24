import { capabilityPostureCatalog } from '../../../../../src/core/capability/registry/index.js';

const invalidEscalationEntry: (typeof capabilityPostureCatalog)['escalation-auto-grant'] = {
  ...capabilityPostureCatalog['escalation-auto-grant'],
  // @ts-expect-error AC-9 requires canRelayApproval in the escalation posture.
  requiredAttestations: ['canPersistApprovalAnswerChannel', 'egress-confinement'],
};

void invalidEscalationEntry;
