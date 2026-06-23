import { capabilityPostureCatalog } from '../../../../../src/core/capability/registry/index.js';

const manualAllowedEntry: (typeof capabilityPostureCatalog)['auto-merge'] = {
  ...capabilityPostureCatalog['auto-merge'],
  // @ts-expect-error AC-4 forbids manual mode in active posture entries.
  allowedMode: ['manual'],
};

void manualAllowedEntry;
