import { describe, expect, it } from 'vitest';

import { capabilityPostureCatalog } from '../../../../src/index.js';

describe('core-02-s1 deferred capability posture', () => {
  it('keeps orchestrator-decide deferred and always denied', () => {
    const entry = capabilityPostureCatalog['orchestrator-decide'];

    expect(entry.status).toBe('deferred');
    expect(entry.denialToken).toBe('capability-deferred');
    expect(entry.allowedMode).toEqual([]);
    expect(entry.requiredGuaranteeIds).toEqual([]);
    expect(entry.requiredAttestations).toEqual([]);
  });
});
