import { describe, expect, it } from 'vitest';

import type { CapabilityAttestation, ForgeCapability, ForgeProvider } from '../../../src/index.js';

import { forgeCapabilities, forgeCapabilityAttestations, forgeScopeFixture } from './fixtures.js';

describe('prov-02-s1 forge capabilities', () => {
  it('uses CapabilityAttestation<ForgeCapability>[] for forge capability probing', () => {
    const provider: ForgeProvider = {
      probeCapabilities: () => forgeCapabilityAttestations,
      pushBranch: () => {
        throw new Error('unused');
      },
      upsertPullRequest: () => {
        throw new Error('unused');
      },
      publishComment: () => {
        throw new Error('unused');
      },
      collectEvidence: () => {
        throw new Error('unused');
      },
      updateBranch: () => {
        throw new Error('unused');
      },
      enqueue: () => {
        throw new Error('unused');
      },
      merge: () => {
        throw new Error('unused');
      },
    };

    const attestations: CapabilityAttestation<ForgeCapability>[] = provider.probeCapabilities(forgeScopeFixture);

    expect(attestations.map((entry) => entry.capability)).toEqual([...forgeCapabilities]);
  });
});
