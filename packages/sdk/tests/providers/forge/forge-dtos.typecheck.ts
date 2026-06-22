import type {
  EvidenceRequest,
  ExpectedHeadActionRequest,
  ForgeBranchRef,
  ForgeRepoRef,
  ForgeScope,
  PullRequestCommentRequest,
  PullRequestRef,
  PullRequestUpsertRequest,
  PushBranchRequest,
} from '../../../src/index.js';

import {
  credentialScopeFixture,
  forgeBranchFixture,
  forgeRepoFixture,
  forgeScopeFixture,
  pullRequestRefFixture,
} from './fixtures.js';

const repo = forgeRepoFixture satisfies ForgeRepoRef;
const branch = forgeBranchFixture satisfies ForgeBranchRef;
const pullRequest = pullRequestRefFixture satisfies PullRequestRef;
const scope = forgeScopeFixture satisfies ForgeScope;

const evidenceRequest = {
  repo,
  pullRequest,
  expectedHeadSha: pullRequest.headSha,
  credentialScope: credentialScopeFixture,
} satisfies EvidenceRequest;

const actionRequest = {
  ...evidenceRequest,
  method: 'merge',
  comment: 'comment',
} satisfies ExpectedHeadActionRequest;

const pushBranch = {
  repo,
  branch,
  credentialScope: credentialScopeFixture,
} satisfies PushBranchRequest;

const upsert = {
  repo,
  pullRequest,
  baseRef: 'v-next',
  headRef: 'codex/epic2-provider-contracts',
  title: 'feat: add forge provider port',
  credentialScope: credentialScopeFixture,
} satisfies PullRequestUpsertRequest;

const comment = {
  repo,
  pullRequest,
  body: 'comment',
  credentialScope: credentialScopeFixture,
} satisfies PullRequestCommentRequest;

// @ts-expect-error AC-2 ForgeRepoRef requires credentialRefId.
const missingRepoField: ForgeRepoRef = {
  provider: repo.provider,
  host: repo.host,
  owner: repo.owner,
  repo: repo.repo,
  defaultBaseRef: repo.defaultBaseRef,
};

// @ts-expect-error AC-2 ForgeBranchRef requires localHeadSha.
const missingBranchField: ForgeBranchRef = {
  branchName: branch.branchName,
};

// @ts-expect-error AC-2 PullRequestRef requires headSha.
const missingPullRequestField: PullRequestRef = {
  providerPullRequestId: pullRequest.providerPullRequestId,
  number: pullRequest.number,
  url: pullRequest.url,
  baseRef: pullRequest.baseRef,
  headRef: pullRequest.headRef,
  author: pullRequest.author,
};

// @ts-expect-error AC-2 ForgeScope requires capabilities.
const missingScopeField: ForgeScope = {
  driverId: scope.driverId,
  driverVersion: scope.driverVersion,
  provider: scope.provider,
  host: scope.host,
  freshnessKey: scope.freshnessKey,
  at: scope.at,
};

// @ts-expect-error AC-2 EvidenceRequest requires credentialScope.
const missingEvidenceField: EvidenceRequest = {
  repo,
  pullRequest,
  expectedHeadSha: pullRequest.headSha,
};

// @ts-expect-error AC-2 PushBranchRequest requires branch.
const missingPushField: PushBranchRequest = {
  repo,
  credentialScope: credentialScopeFixture,
};

// @ts-expect-error AC-2 PullRequestUpsertRequest requires title.
const missingUpsertField: PullRequestUpsertRequest = {
  repo,
  baseRef: 'v-next',
  headRef: 'branch',
  credentialScope: credentialScopeFixture,
};

// @ts-expect-error AC-2 PullRequestCommentRequest requires body.
const missingCommentField: PullRequestCommentRequest = {
  repo,
  pullRequest,
  credentialScope: credentialScopeFixture,
};

void repo;
void branch;
void pullRequest;
void scope;
void evidenceRequest;
void actionRequest;
void pushBranch;
void upsert;
void comment;
void missingRepoField;
void missingBranchField;
void missingPullRequestField;
void missingScopeField;
void missingEvidenceField;
void missingPushField;
void missingUpsertField;
void missingCommentField;
