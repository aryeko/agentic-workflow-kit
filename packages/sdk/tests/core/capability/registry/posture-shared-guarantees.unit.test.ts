import { describe, expect, it } from 'vitest';

import { capabilityPostureCatalog, guaranteeRequirementCatalog } from '../../../../src/index.js';

describe('core-02-s1 shared guarantee coverage', () => {
  it('requires every non-deferred capability to reference the full shared guarantee catalog', () => {
    const activeEntries = Object.values(capabilityPostureCatalog).filter((entry) => entry.status === 'assisted');

    expect(activeEntries.length).toBe(4);
    expect(
      activeEntries.every((entry) => entry.requiredGuaranteeIds.length === guaranteeRequirementCatalog.length),
    ).toBe(true);
    expect(
      activeEntries.every((entry) => entry.requiredGuaranteeIds.join('|') === guaranteeRequirementCatalog.join('|')),
    ).toBe(true);
  });
});
