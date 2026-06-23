import { describe, expect, it } from 'vitest';

import type { ForgeDegraded, ForgeEvidenceSnapshot, ForgeProvider } from '../../../src/index.js';

import { degradedResultFixture, evidenceRequestFixture, evidenceSnapshotFixture } from './fixtures.js';

describe('prov-02-s1 forge collect evidence', () => {
  it('permits authoritative snapshots and degraded reads as distinct return branches', () => {
    const authoritativeProvider: ForgeProvider = {
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
    };

    const degradedProvider: ForgeProvider = {
      ...authoritativeProvider,
      collectEvidence: () => degradedResultFixture,
    };

    const authoritative: ForgeEvidenceSnapshot | ForgeDegraded =
      authoritativeProvider.collectEvidence(evidenceRequestFixture);
    const degraded: ForgeEvidenceSnapshot | ForgeDegraded = degradedProvider.collectEvidence(evidenceRequestFixture);

    expect(authoritative.kind).toBeUndefined();
    expect(degraded.kind).toBe('degraded');
    expect(degraded.token).toBe('forge-state-unknown');
  });
});
