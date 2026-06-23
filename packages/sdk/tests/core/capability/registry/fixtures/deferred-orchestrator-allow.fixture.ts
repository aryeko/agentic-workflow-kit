import { capabilityPostureCatalog } from '../../../../../src/core/capability/registry/index.js';

const invalidDeferredStatus: (typeof capabilityPostureCatalog)['orchestrator-decide'] = {
  ...capabilityPostureCatalog['orchestrator-decide'],
  // @ts-expect-error AC-5 keeps orchestrator-decide deferred in v1.
  status: 'assisted',
};

const invalidDeferredAttestations: (typeof capabilityPostureCatalog)['orchestrator-decide'] = {
  ...capabilityPostureCatalog['orchestrator-decide'],
  // @ts-expect-error AC-5 keeps deferred capabilities free of attestation requirements.
  requiredAttestations: ['canRelayApproval'],
};

void invalidDeferredStatus;
void invalidDeferredAttestations;
