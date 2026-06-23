import { describe, expect, it } from 'vitest';

import {
  credentialScopeFixture,
  evidenceRequestFixture,
  expectedHeadActionRequestFixture,
  forgeBranchFixture,
  forgeRepoFixture,
  forgeScopeFixture,
  pullRequestCommentRequestFixture,
  pullRequestRefFixture,
  pullRequestUpsertRequestFixture,
  pushBranchRequestFixture,
} from './fixtures.js';

describe('prov-02-s1 forge request and ref DTOs', () => {
  it('constructs the request and ref fixtures with the design-owned fields', () => {
    expect(forgeRepoFixture.defaultBaseRef).toBe('v-next');
    expect(forgeBranchFixture.pushResult).toBe('pushed');
    expect(pullRequestRefFixture.providerPullRequestId).toBe('PR_kwDOExample');
    expect(forgeScopeFixture.capabilities).toHaveLength(4);
    expect(credentialScopeFixture.phase).toBe('merge');
    expect(evidenceRequestFixture.expectedHeadSha).toBe(pullRequestRefFixture.headSha);
    expect(expectedHeadActionRequestFixture.method).toBe('merge');
    expect(pushBranchRequestFixture.branch).toEqual(forgeBranchFixture);
    expect(pullRequestUpsertRequestFixture.pullRequest).toEqual(pullRequestRefFixture);
    expect(pullRequestCommentRequestFixture.pullRequest).toEqual(pullRequestRefFixture);
  });
});
