import { capabilityPostureCatalog } from '../../../../../src/core/capability/registry/index.js';

const invalidAutoRecoverEntry: (typeof capabilityPostureCatalog)['auto-recover'] = {
  ...capabilityPostureCatalog['auto-recover'],
  // @ts-expect-error AC-7 requires canKill in the auto-recover posture.
  requiredAttestations: ['containmentStrength', 'preservesHostProcessParentage'],
};

void invalidAutoRecoverEntry;
