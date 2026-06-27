import type { ApprovalDecisionRecordedPayload } from '../../approval/contracts/index.js';
import type {
  EvidenceEventRef,
  RunAppendFailure,
  RunAppendReceipt,
  RunEventCursor,
  RunEventEnvelope,
  RunProjections,
  RunReplay,
  RunWriter,
} from '../../run-lifecycle/contracts/index.js';
import type {
  ChangedFileClass,
  CompletionDecisionPayload,
  ProtectedPolicySnapshotRecordedPayload,
} from '../contracts/index.js';
import type { CommandKind, CommandResult, HostFailure } from '../../../providers/execution-host/index.js';
import type { LocalGitEvidenceRecordedPayload } from '../../../foundation/workspace-repository/worktree/index.js';

export type CompletionEvidenceEvent = RunEventEnvelope<
  | ApprovalDecisionRecordedPayload
  | CommandResult
  | HostFailure
  | LocalGitEvidenceRecordedPayload
  | ProtectedPolicySnapshotRecordedPayload
  | Record<string, unknown>
>;

export type CandidateHeadSelection =
  | {
      readonly ok: true;
      readonly headSha: string;
      readonly localGit: EvidenceEventRef;
      readonly localGitPayload: LocalGitEvidenceRecordedPayload;
      readonly evidenceRefs: readonly EvidenceEventRef[];
    }
  | {
      readonly ok: false;
      readonly state: 'head-ambiguous' | 'workspace-dirty';
      readonly headSha?: string;
      readonly evidenceRefs: readonly EvidenceEventRef[];
    };

export interface ChangedPathClassification {
  readonly path: string;
  readonly class: ChangedFileClass;
}

export interface ChangedPathGateResult {
  readonly classifications: readonly ChangedPathClassification[];
  readonly state?:
    | 'changed-file-policy-absent'
    | 'changed-files-outside-allowlist'
    | 'protected-policy-change-unapproved';
}

export interface VerificationWindow {
  readonly commandRef: EvidenceEventRef;
  readonly command: CommandResult & { readonly kind?: CommandKind };
  readonly preLocalGitRef: EvidenceEventRef;
  readonly preLocalGit: LocalGitEvidenceRecordedPayload;
  readonly postLocalGitRef: EvidenceEventRef;
  readonly postLocalGit: LocalGitEvidenceRecordedPayload;
  readonly hostFailureRef?: EvidenceEventRef;
  readonly hostFailure?: HostFailure;
}

export interface VerificationFreshnessResult {
  readonly fresh: boolean;
  readonly state?: 'verification-failed' | 'verification-uncertain';
  readonly evidenceRefs: readonly EvidenceEventRef[];
}

export interface WorkerClaim {
  readonly assertsDone: boolean;
  readonly assertsMergeReady?: boolean;
  readonly headSha?: string;
}

export interface WorkerClaimEvidence {
  readonly ref: EvidenceEventRef;
  readonly claim: WorkerClaim;
}

export interface ProtectedPolicySnapshotInput {
  readonly runId: string;
  readonly policyRef: string;
  readonly policyDigest: string;
  readonly baseSha: string;
  readonly verifierCommandDigest: string;
  readonly protectedPathSets: ProtectedPolicySnapshotRecordedPayload['protectedPathSets'];
  readonly recordedAt: string;
}

export interface EvaluateCompletionInput {
  readonly runId: string;
  readonly evaluatedAt: string;
  readonly evaluatedThrough: RunEventCursor;
  readonly leaseId: string;
  readonly policyRef: string;
  readonly allowedChangePaths?: readonly string[];
  readonly runnerEvidencePaths?: readonly string[];
  readonly protectedPolicySnapshot?: ProtectedPolicySnapshotInput;
  readonly workerClaim?: WorkerClaimEvidence;
  readonly verification?: VerificationWindow;
  readonly forgeEvidenceAvailable?: boolean;
}

export interface CompletionEvaluationCommit {
  readonly decision: CompletionDecisionPayload;
  readonly decisionEventId: string;
  readonly appendReceipt: RunAppendReceipt;
  readonly protectedPolicySnapshot?: ProtectedPolicySnapshotRecordedPayload;
  readonly protectedPolicySnapshotEventId?: string;
}

export interface CompletionEvaluationFailure {
  readonly token: 'event-log-unwritable';
  readonly appendFailure: RunAppendFailure;
}

export interface CompletionEvaluatorDependencies {
  readonly replay: RunReplay;
  readonly projections: RunProjections;
  readonly writer: RunWriter;
}
