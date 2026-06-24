import {
  type CapabilityId,
  type CapabilityMode,
  type CapabilityRegistryDenialToken,
  capabilityPostureCatalog,
  guaranteeRequirementCatalog,
  type PostureEntry,
} from 'sdk';
import { describe, expect, it } from 'vitest';

describe('core-02-s1 public sdk exports', () => {
  it('exposes the registry catalog and types from the sdk entrypoint', () => {
    const capabilityId: CapabilityId = 'auto-merge';
    const capabilityMode: CapabilityMode = 'assisted';
    const denialToken: CapabilityRegistryDenialToken = 'capability-deferred';
    const postureEntry: PostureEntry = capabilityPostureCatalog[capabilityId];

    expect(capabilityMode).toBe('assisted');
    expect(denialToken).toBe('capability-deferred');
    expect(postureEntry).toMatchObject({
      status: 'assisted',
      allowedMode: ['assisted'],
      requiredGuaranteeIds: guaranteeRequirementCatalog,
      requiredAttestations: capabilityPostureCatalog['auto-merge'].requiredAttestations,
    });
    expect(guaranteeRequirementCatalog).toHaveLength(5);
  });
});
