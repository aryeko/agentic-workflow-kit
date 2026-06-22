export interface ForgeObservedFacts {
  readonly prState?: ForgePrStateFacts;
  readonly statusChecks?: ForgeStatusCheckFacts;
  readonly reviewThreads?: ForgeReviewThreadFacts;
  readonly protection?: ForgeProtectionFacts;
  readonly mergeQueue?: ForgeMergeQueueFacts;
}

export interface ForgePrStateFacts {
  readonly baseRefOid: string;
  readonly headRefOid: string;
  readonly state: 'OPEN' | 'CLOSED' | 'MERGED';
  readonly reviewDecision?: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED';
  readonly mergeStateStatus: string;
  readonly isInMergeQueue: boolean;
}

export interface ForgeStatusCheckFacts {
  readonly state: 'EXPECTED' | 'ERROR' | 'FAILURE' | 'PENDING' | 'SUCCESS';
  readonly contexts: readonly ForgeStatusCheckContext[];
}

export interface ForgeStatusCheckContext {
  readonly name: string;
  readonly state?: string;
  readonly conclusion?: string;
}

export interface ForgeReviewThreadFacts {
  readonly threads: readonly ForgeReviewThread[];
}

export interface ForgeReviewThread {
  readonly id: string;
  readonly isResolved: boolean;
  readonly viewerCanResolve: boolean;
  readonly path: string;
  readonly comments: readonly ForgeReviewThreadComment[];
}

export interface ForgeReviewThreadComment {
  readonly id: string;
  readonly author: string;
  readonly bodyRef: string;
}

export interface ForgeProtectionFacts {
  readonly branchProtectionRules: readonly ForgeBranchProtectionRule[];
  readonly rulesets: readonly ForgeRuleset[];
}

export interface ForgeBranchProtectionRule {
  readonly pattern: string;
  readonly requiredStatusCheckContexts: readonly string[];
  readonly requiresApprovingReviews: boolean;
  readonly requiresStatusChecks: boolean;
  readonly requiresStrictStatusChecks: boolean;
  readonly requiresCommitSignatures: boolean;
  readonly allowsForcePushes: boolean;
  readonly allowsDeletions: boolean;
  readonly blocksCreations: boolean;
}

export interface ForgeRuleset {
  readonly id: string;
  readonly name: string;
  readonly enforcement: string;
  readonly target?: string;
}

export interface ForgeMergeQueueFacts {
  readonly mergeQueuePresent: boolean;
  readonly mergeQueueEntry?: ForgeMergeQueueEntry;
}

export interface ForgeMergeQueueEntry {
  readonly position: number;
  readonly state: string;
  readonly baseCommitOid?: string;
  readonly headCommitOid?: string;
}
