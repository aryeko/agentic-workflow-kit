import { capabilityPostureCatalog } from '../../../../../src/core/capability/registry/index.js';

const incompleteGuaranteeEntry: (typeof capabilityPostureCatalog)['auto-merge'] = {
  ...capabilityPostureCatalog['auto-merge'],
  // @ts-expect-error AC-12 requires every shared guarantee on active posture entries.
  requiredGuaranteeIds: [
    'assisted-mode-required',
    'policy-permits-capability',
    'replay-health-usable',
    'recorded-evidence-unambiguous-not-self-report',
  ],
};

void incompleteGuaranteeEntry;
