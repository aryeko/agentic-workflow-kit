import { describe, expect, it } from 'vitest';

import type { ForgeProvider } from '../../../src/index.js';

import {
  acceptedActionResultFixture,
  evidenceRequestFixture,
  evidenceSnapshotFixture,
  expectedHeadActionRequestFixture,
  forgeCapabilityAttestations,
  forgeScopeFixture,
  pullRequestCommentRequestFixture,
  pullRequestUpsertRequestFixture,
  pushBranchRequestFixture,
} from './fixtures.js';

describe('prov-02-s1 forge provider shape', () => {
  it('accepts a fixture implementing all eight ForgeProvider operations', () => {
    const provider: ForgeProvider = {
      probeCapabilities: (scope) => {
        expect(scope).toEqual(forgeScopeFixture);
        return forgeCapabilityAttestations;
      },
      pushBranch: (req) => {
        expect(req).toEqual(pushBranchRequestFixture);
        return acceptedActionResultFixture;
      },
      upsertPullRequest: (req) => {
        expect(req).toEqual(pullRequestUpsertRequestFixture);
        return acceptedActionResultFixture;
      },
      publishComment: (req) => {
        expect(req).toEqual(pullRequestCommentRequestFixture);
        return acceptedActionResultFixture;
      },
      collectEvidence: (req) => {
        expect(req).toEqual(evidenceRequestFixture);
        return evidenceSnapshotFixture;
      },
      updateBranch: (req) => {
        expect(req).toEqual(expectedHeadActionRequestFixture);
        return acceptedActionResultFixture;
      },
      enqueue: (req) => {
        expect(req).toEqual(expectedHeadActionRequestFixture);
        return acceptedActionResultFixture;
      },
      merge: (req) => {
        expect(req).toEqual(expectedHeadActionRequestFixture);
        return acceptedActionResultFixture;
      },
    };

    expect(provider.probeCapabilities(forgeScopeFixture)).toEqual(forgeCapabilityAttestations);
    expect(provider.pushBranch(pushBranchRequestFixture)).toEqual(acceptedActionResultFixture);
    expect(provider.upsertPullRequest(pullRequestUpsertRequestFixture)).toEqual(acceptedActionResultFixture);
    expect(provider.publishComment(pullRequestCommentRequestFixture)).toEqual(acceptedActionResultFixture);
    expect(provider.collectEvidence(evidenceRequestFixture)).toEqual(evidenceSnapshotFixture);
    expect(provider.updateBranch(expectedHeadActionRequestFixture)).toEqual(acceptedActionResultFixture);
    expect(provider.enqueue(expectedHeadActionRequestFixture)).toEqual(acceptedActionResultFixture);
    expect(provider.merge(expectedHeadActionRequestFixture)).toEqual(acceptedActionResultFixture);
  });
});
