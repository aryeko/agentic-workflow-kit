import type { ForgeDegraded, ForgeEvidenceSnapshot, ForgeProvider } from '../../../src/index.js';

import { degradedResultFixture, evidenceSnapshotFixture } from './fixtures.js';

const provider = {
  probeCapabilities: () => [],
  pushBranch: () => {
    throw new Error('unused');
  },
  upsertPullRequest: () => {
    throw new Error('unused');
  },
  publishComment: () => {
    throw new Error('unused');
  },
  collectEvidence: () => evidenceSnapshotFixture,
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

const degraded = degradedResultFixture satisfies ForgeDegraded;

// @ts-expect-error AC-6 degraded reads are not authoritative snapshots.
const snapshotFromDegraded: ForgeEvidenceSnapshot = degraded;

void provider;
void degraded;
void snapshotFromDegraded;
