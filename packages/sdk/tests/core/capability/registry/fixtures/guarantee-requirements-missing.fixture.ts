import type { guaranteeRequirementCatalog } from '../../../../../src/core/capability/registry/index.js';

// @ts-expect-error AC-11 requires all five shared guarantee identifiers.
const incompleteGuaranteeCatalog: typeof guaranteeRequirementCatalog = [
  'assisted-mode-required',
  'policy-permits-capability',
  'replay-health-usable',
  'recorded-evidence-unambiguous-not-self-report',
];

void incompleteGuaranteeCatalog;
