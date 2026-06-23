import type {
  ArtifactInput,
  ArtifactRef,
  ArtifactStore,
  ScratchArtifactRef,
} from '../../../foundation/storage/artifacts/index.js';
import type {
  EvidenceEventRef,
  RunAppendFailure,
  RunAppendReceipt,
  RunReplay,
} from '../../run-lifecycle/contracts/index.js';
import type {
  AnalysisFailureReason,
  AnalysisInputHealth,
  AnalysisIssue,
  AnalysisOutcome,
  AnalysisRequest,
  RecordableAnalysisFailureReason,
} from '../analyzer/types.js';
import type { MetricValue } from '../telemetry/index.js';

export type { AnalysisFailureReason, RecordableAnalysisFailureReason };

export interface AnalysisRecordInput {
  request: AnalysisRequest;
  inputHealth: AnalysisInputHealth;
  outcome: AnalysisOutcome;
  supersedesEventId?: string;
}

export type AnalysisRecordOptions = {
  artifactStore?: ArtifactStore;
  reportArtifact?: ArtifactInput;
  replay?: RunReplay;
  logWritable?: boolean;
};

export type AnalysisRecordCommit =
  | { status: 'appended'; eventRef: EvidenceEventRef; appendReceipt: RunAppendReceipt }
  | { status: 'already-committed'; eventRef: EvidenceEventRef };

export interface AnalysisRecordFailure {
  reason: 'analysis-record-unwritable';
  attemptedEventId: string;
  attemptedPayloadDigest: string;
  appendFailure?: RunAppendFailure;
  conflict?: 'event-id-digest-mismatch' | 'current-analysis-conflict';
  retry: 'replay-before-retry';
}

export interface AnalysisRecordedPayload {
  schema: 'kit-vnext.analysis-recorded.v1';
  request: AnalysisRequest;
  inputHealth: AnalysisInputHealth;
  issues: AnalysisIssue[];
  metrics: Record<string, MetricValue<unknown>>;
  evidenceRefs: EvidenceEventRef[];
  reportArtifactRef?: ArtifactRef;
  supersedesEventId?: string;
}

export interface AnalysisFailedPayload {
  schema: 'kit-vnext.analysis-failed.v1';
  request: AnalysisRequest;
  inputHealth: AnalysisInputHealth;
  reason: RecordableAnalysisFailureReason;
  evidenceRefs: EvidenceEventRef[];
  artifactRefs: ArtifactRef[];
  supersedesEventId?: string;
}

export type AnalysisPayload = AnalysisRecordedPayload | AnalysisFailedPayload;
export type AnalysisReportRefCandidate = ArtifactRef | ScratchArtifactRef;

export type TerminalAnalysisInvariantResult =
  | { status: 'not-terminal' }
  | { status: 'satisfied'; eventRef: EvidenceEventRef }
  | {
      status: 'unmet';
      reason: 'analysis-invariant-missing' | 'analysis-record-unwritable';
      terminalEventRef?: EvidenceEventRef;
    };
