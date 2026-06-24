import { describe, expect, it } from 'vitest';

import { capabilityPostureCatalog } from '../../../../src/index.js';

describe('core-02-s1 posture modes', () => {
  it('limits every non-deferred capability to assisted mode', () => {
    const activeEntries = Object.values(capabilityPostureCatalog).filter((entry) => entry.status === 'assisted');

    expect(activeEntries.length).toBe(4);
    expect(activeEntries.every((entry) => entry.allowedMode.length === 1)).toBe(true);
    expect(activeEntries.every((entry) => entry.allowedMode[0] === 'assisted')).toBe(true);
  });
});
