import type { TokenTotals } from '../types.js';

export interface AnalyzeOptions {
  sessionRoots?: string[];
  now?: string;
}

export interface WorkflowRunAnalysis {
  runId: string;
  status: string;
  derivedStatus: string;
  blockedReason: string | null;
  issues: string[];
  children: AnalyzedChild[];
  commandCounts: Record<string, number>;
  subagentCounts: Record<string, number>;
  tokenTotals: TokenTotals | null;
  review: ReviewSummary;
  verification: VerificationSummary;
  merge: MergeSummary;
  timeline: TimelineEvent[];
  artifacts: ArtifactEvidenceSummary;
}

export interface ArtifactEvidenceSummary {
  summary: {
    present: boolean;
    schemaVersion: number | null;
    artifactPaths: string[];
    unavailable: Record<string, string>;
  };
  rows: {
    present: boolean;
    schemaVersion: number | null;
    count: number;
    storyIds: string[];
  };
  budgets: {
    present: boolean;
    schemaVersion: number | null;
    evaluationCount: number;
    unavailable: BudgetEvaluationSummary[];
    warnings: BudgetEvaluationSummary[];
    stops: BudgetEvaluationSummary[];
  };
  transcripts: {
    present: boolean;
    schemaVersion: number | null;
    count: number;
    linked: number;
    missing: number;
    unlinked: number;
  };
}

export interface BudgetEvaluationSummary {
  profileName: string | null;
  taskType: string | null;
  dimension: string | null;
  status: string | null;
  eventType: string | null;
  unavailableReason: string | null;
}

export interface AnalyzedChild {
  storyId: string;
  ok: boolean;
  sessionId: string | null;
  sessionLogPath: string | null;
  linkageStatus: 'linked' | 'diagnostic_candidate_only' | 'unlinked';
  diagnosticSessionCandidates: DiagnosticSessionCandidate[];
  metricsStatus: 'available' | 'session_linkage_unavailable' | 'session_log_missing';
  status: string;
  expectedBranch: string | null;
  expectedWorktreePath: string | null;
  failedSpawnAgentAttempts: number;
  recoveryEvents: ChildRecoveryEvent[];
  completionAuthority: string | null;
  completionAuthoritySource: string | null;
  staleParentSnapshot: boolean;
  progress: ChildProgressSummary;
  verification: ChildVerificationEvidence[];
  merge: ChildMergeEvidence;
  review: ChildReviewEvidence;
}

export interface DiagnosticSessionCandidate {
  sessionId: string;
  evidence: string;
}

export interface ChildRecoveryEvent {
  type: string;
  decision: string | null;
  evidence: string[];
}

export interface ChildProgressSummary {
  lastSupervisorPollAt: string | null;
  lastObservedChildProgressAt: string | null;
  progressSource: string | null;
}

export interface ChildVerificationEvidence {
  command: string | null;
  status: string;
  phase?: string | null;
  detail?: string | null;
}

export interface ChildMergeEvidence {
  merged: boolean;
  prNumber: number | null;
  prUrl: string | null;
  mergeCommit: string | null;
  mergedAt: string | null;
  branchDeleted: boolean | null;
}

export interface ChildReviewEvidence {
  prePr: unknown;
  pr: unknown;
}

export interface ReviewSummary {
  prePr: PrePrReviewSummary;
  pr: PrReviewSummary;
}

export interface PrePrReviewSummary {
  requestedMode: string | null;
  actualMode: string | null;
  status: 'not_configured' | 'not_started' | 'downgraded' | 'blocked' | 'passed' | 'findings';
  warnings: string[];
  blockers: string[];
  maxLoops: number | null;
  loopMode: string | null;
  fixBatchCount: number;
  maxLoopsReached: boolean;
  loops: PrePrReviewLoop[];
  subagent: {
    agentId: string | null;
    status: string | null;
  };
}

export interface PrePrReviewLoop {
  loop: number | null;
  mode: string | null;
  status: string;
  findings: number | null;
  agentId: string | null;
  previousAgentId: string | null;
  continuityMode: string | null;
}

export interface PrReviewSummary {
  findings: PrReviewFinding[];
  fixBatchCount: number;
  resolvedThreadCount: number;
  rerequestAfterFix: boolean | null;
}

export interface PrReviewFinding {
  severity: string | null;
  summary: string;
  file: string | null;
}

export interface VerificationSummary {
  commands: VerificationCommandSummary[];
  finalPassedAt: string | null;
}

export interface VerificationCommandSummary {
  phase: string | null;
  command: string | null;
  status: string;
  eventAt: string | null;
}

export interface MergeSummary {
  merged: boolean;
  mergedAt: string | null;
  cleanupStatus: string | null;
  mergeBeforeFinalVerification: boolean;
}

export interface TimelineEvent {
  type: string;
  eventAt: string | null;
  recordedAt: string | null;
  index: number;
}

export interface NormalizedEvent extends TimelineEvent {
  raw: Record<string, unknown>;
}

export interface AnalyzerIssue {
  key: string;
  message: string;
}
