import type { CapabilityAttestation } from '../attestation/index.js';
import type { ForgeEvidenceSnapshot } from './evidence.js';
import type {
  EvidenceRequest,
  ExpectedHeadActionRequest,
  PullRequestCommentRequest,
  PullRequestUpsertRequest,
  PushBranchRequest,
} from './requests.js';
import type { ForgeActionResult, ForgeDegraded } from './results.js';
import type { ForgeScope } from './refs.js';
import type { ForgeCapability } from './types.js';

export interface ForgeProvider {
  probeCapabilities(scope: ForgeScope): CapabilityAttestation<ForgeCapability>[];
  pushBranch(req: PushBranchRequest): ForgeActionResult;
  upsertPullRequest(req: PullRequestUpsertRequest): ForgeActionResult;
  publishComment(req: PullRequestCommentRequest): ForgeActionResult;
  collectEvidence(req: EvidenceRequest): ForgeEvidenceSnapshot | ForgeDegraded;
  updateBranch(req: ExpectedHeadActionRequest): ForgeActionResult;
  enqueue(req: ExpectedHeadActionRequest): ForgeActionResult;
  merge(req: ExpectedHeadActionRequest): ForgeActionResult;
}
