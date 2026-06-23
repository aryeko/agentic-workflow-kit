import { capabilityPostureCatalog } from '../../../../../src/core/capability/registry/index.js';

// @ts-expect-error AC-3 requires one posture entry per CapabilityId.
const catalogMissingEntry: typeof capabilityPostureCatalog = {
  'auto-merge': capabilityPostureCatalog['auto-merge'],
  'auto-recover': capabilityPostureCatalog['auto-recover'],
  'unattended-run': capabilityPostureCatalog['unattended-run'],
  'escalation-auto-grant': capabilityPostureCatalog['escalation-auto-grant'],
};

void catalogMissingEntry;
