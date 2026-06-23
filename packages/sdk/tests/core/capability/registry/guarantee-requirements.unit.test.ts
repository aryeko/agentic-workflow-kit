import { describe, expect, it } from 'vitest';

import { guaranteeRequirementCatalog } from '../../../../src/index.js';

import { expectedGuaranteeRequirementIds } from './shared.js';

describe('core-02-s1 guarantee requirement catalog', () => {
  it('defines the exact shared guarantee requirement identifiers', () => {
    expect(guaranteeRequirementCatalog).toEqual(expectedGuaranteeRequirementIds);
  });

  it('freezes the runtime guarantee catalog and rejects mutation', () => {
    expect(Object.isFrozen(guaranteeRequirementCatalog)).toBe(true);

    expect(() => {
      (guaranteeRequirementCatalog as unknown as string[]).push('future-guarantee');
    }).toThrow(TypeError);
  });
});
