import { describe, expect, it } from 'vitest';

import { capabilityPostureCatalog } from '../../../../src/index.js';

import { expectedCapabilityIds } from './shared.js';

describe('core-02-s1 posture catalog coverage', () => {
  it('defines one posture entry per capability id', () => {
    expect(Object.keys(capabilityPostureCatalog)).toEqual(expectedCapabilityIds);
  });

  it('freezes the posture catalog deeply and rejects runtime mutation', () => {
    const autoMergeEntry = capabilityPostureCatalog['auto-merge'];

    expect(Object.isFrozen(capabilityPostureCatalog)).toBe(true);
    expect(Object.isFrozen(autoMergeEntry)).toBe(true);
    expect(Object.isFrozen(autoMergeEntry.allowedMode)).toBe(true);
    expect(Object.isFrozen(autoMergeEntry.requiredGuaranteeIds)).toBe(true);
    expect(Object.isFrozen(autoMergeEntry.requiredAttestations)).toBe(true);
    expect(Object.isFrozen(capabilityPostureCatalog['auto-recover'].containmentFloor)).toBe(true);

    expect(() => {
      (capabilityPostureCatalog as Record<string, unknown>)['future-capability'] = autoMergeEntry;
    }).toThrow(TypeError);
    expect(() => {
      (autoMergeEntry as { status: string }).status = 'deferred';
    }).toThrow(TypeError);
    expect(() => {
      (autoMergeEntry.allowedMode as unknown as string[]).push('manual');
    }).toThrow(TypeError);
    expect(() => {
      (autoMergeEntry.requiredGuaranteeIds as unknown as string[]).push('future-guarantee');
    }).toThrow(TypeError);
    expect(() => {
      (autoMergeEntry.requiredAttestations as unknown as string[]).push('future-attestation');
    }).toThrow(TypeError);
    expect(() => {
      (capabilityPostureCatalog['auto-recover'].containmentFloor as unknown as string[]).push('none');
    }).toThrow(TypeError);
  });
});
