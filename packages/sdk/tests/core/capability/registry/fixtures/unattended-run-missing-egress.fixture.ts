import { capabilityPostureCatalog } from '../../../../../src/core/capability/registry/index.js';

const invalidUnattendedRunEntry: (typeof capabilityPostureCatalog)['unattended-run'] = {
  ...capabilityPostureCatalog['unattended-run'],
  // @ts-expect-error AC-8 requires egress-confinement in the unattended-run posture.
  requiredAttestations: ['supportsClaim', 'canKill', 'containmentStrength', 'preservesHostProcessParentage'],
};

void invalidUnattendedRunEntry;
