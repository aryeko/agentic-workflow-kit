import { capabilityPostureCatalog } from '../../../../../src/core/capability/registry/index.js';

const invalidAutoMergeEntry: (typeof capabilityPostureCatalog)['auto-merge'] = {
  ...capabilityPostureCatalog['auto-merge'],
  // @ts-expect-error AC-6 requires supportsRulesets in the auto-merge posture.
  requiredAttestations: ['canInspectProtection', 'supportsMergeQueue', 'supportsStatusWrite'],
};

void invalidAutoMergeEntry;
