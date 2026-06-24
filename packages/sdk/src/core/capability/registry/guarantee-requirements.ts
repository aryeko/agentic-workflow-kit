import { deepFreeze } from './deep-freeze.js';

export const guaranteeRequirementCatalog = deepFreeze([
  'assisted-mode-required',
  'policy-permits-capability',
  'replay-health-usable',
  'recorded-evidence-unambiguous-not-self-report',
  'attestations-fresh-positive-in-scope-non-contradictory-replayable',
] as const);

export type GuaranteeRequirementId = (typeof guaranteeRequirementCatalog)[number];
