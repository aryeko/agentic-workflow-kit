import type { ForgeCapability } from './types.js';

export interface ForgeRepoRef {
  readonly provider: string;
  readonly host: string;
  readonly owner: string;
  readonly repo: string;
  readonly defaultBaseRef: string;
  readonly credentialRefId: string;
}

export interface ForgeBranchRef {
  readonly branchName: string;
  readonly localHeadSha: string;
  readonly remoteHeadSha?: string;
  readonly pushResult?: 'pushed' | 'rejected' | 'not-pushed';
}

export interface PullRequestRef {
  readonly providerPullRequestId: string;
  readonly number: number;
  readonly url: string;
  readonly baseRef: string;
  readonly headRef: string;
  readonly author: string;
  readonly headSha: string;
}

export interface ForgeScope {
  readonly driverId: string;
  readonly driverVersion: string;
  readonly provider: string;
  readonly host: string;
  readonly freshnessKey: string;
  readonly capabilities: readonly ForgeCapability[];
  readonly at: string;
}
