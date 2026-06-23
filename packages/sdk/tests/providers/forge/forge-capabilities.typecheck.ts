import type { CapabilityAttestation, ForgeCapability, ForgeProvider } from '../../../src/index.js';

import { forgeCapabilityAttestations } from './fixtures.js';

const provider = {
  probeCapabilities: (_scope) => forgeCapabilityAttestations,
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
} satisfies ForgeProvider;

const attestations: CapabilityAttestation<ForgeCapability>[] = provider.probeCapabilities({
  driverId: 'provider-github',
  driverVersion: '1.0.0',
  provider: 'github',
  host: 'github.com',
  freshnessKey: 'forge:github',
  capabilities: ['supportsRulesets', 'supportsMergeQueue', 'supportsThreadResolution', 'canInspectProtection'],
  at: '2026-06-22T12:00:00.000Z',
});

// @ts-expect-error AC-7 rejects non-member forge capabilities.
const invalidCapability: ForgeCapability = 'canTeleportMergeQueue';

void provider;
void attestations;
void invalidCapability;
