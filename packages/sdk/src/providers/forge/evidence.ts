import type {
  ForgeMergeQueueFacts,
  ForgePrStateFacts,
  ForgeProtectionFacts,
  ForgeReviewThreadFacts,
  ForgeStatusCheckFacts,
} from './observed-facts.js';
import type { ForgeRepoRef, ForgeScope, PullRequestRef } from './refs.js';

export interface ForgeEvidenceSnapshot {
  readonly repo: ForgeRepoRef;
  readonly pullRequest: PullRequestRef;
  readonly expectedHeadSha: string;
  readonly prState: ForgePrStateFacts;
  readonly statusChecks: ForgeStatusCheckFacts;
  readonly reviewThreads: ForgeReviewThreadFacts;
  readonly protection: ForgeProtectionFacts;
  readonly mergeQueue: ForgeMergeQueueFacts;
  readonly scope: ForgeScope;
  readonly evidenceRefs: readonly string[];
  readonly redactionFingerprintIds: readonly string[];
  readonly credentialAuditEventIds: readonly string[];
  readonly collectedAt: string;
}
