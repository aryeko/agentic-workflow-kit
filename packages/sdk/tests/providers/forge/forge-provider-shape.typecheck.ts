import type { ForgeProvider } from '../../../src/index.js';

import { acceptedActionResultFixture, evidenceSnapshotFixture, forgeCapabilityAttestations } from './fixtures.js';

const validProvider = {
  probeCapabilities: () => forgeCapabilityAttestations,
  pushBranch: () => acceptedActionResultFixture,
  upsertPullRequest: () => acceptedActionResultFixture,
  publishComment: () => acceptedActionResultFixture,
  collectEvidence: () => evidenceSnapshotFixture,
  updateBranch: () => acceptedActionResultFixture,
  enqueue: () => acceptedActionResultFixture,
  merge: () => acceptedActionResultFixture,
} satisfies ForgeProvider;

// @ts-expect-error AC-1 requires merge on ForgeProvider.
const missingOperation: ForgeProvider = {
  probeCapabilities: () => forgeCapabilityAttestations,
  pushBranch: () => acceptedActionResultFixture,
  upsertPullRequest: () => acceptedActionResultFixture,
  publishComment: () => acceptedActionResultFixture,
  collectEvidence: () => evidenceSnapshotFixture,
  updateBranch: () => acceptedActionResultFixture,
  enqueue: () => acceptedActionResultFixture,
};

void validProvider;
void missingOperation;
