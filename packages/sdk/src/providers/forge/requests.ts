import type { CredentialScope } from '../../foundation/credentials-secrets/scopes/index.js';
import type { ForgeBranchRef, ForgeRepoRef, PullRequestRef } from './refs.js';

export interface EvidenceRequest {
  readonly repo: ForgeRepoRef;
  readonly pullRequest: PullRequestRef;
  readonly expectedHeadSha: string;
  readonly credentialScope: CredentialScope;
}

export interface ExpectedHeadActionRequest extends EvidenceRequest {
  readonly method?: 'merge' | 'squash' | 'rebase';
  readonly comment?: string;
}

export interface PushBranchRequest {
  readonly repo: ForgeRepoRef;
  readonly branch: ForgeBranchRef;
  readonly credentialScope: CredentialScope;
}

export interface PullRequestUpsertRequest {
  readonly repo: ForgeRepoRef;
  readonly pullRequest?: PullRequestRef;
  readonly baseRef: string;
  readonly headRef: string;
  readonly title: string;
  readonly body?: string;
  readonly draft?: boolean;
  readonly credentialScope: CredentialScope;
}

export interface PullRequestCommentRequest {
  readonly repo: ForgeRepoRef;
  readonly pullRequest: PullRequestRef;
  readonly commentId?: string;
  readonly body: string;
  readonly credentialScope: CredentialScope;
}
