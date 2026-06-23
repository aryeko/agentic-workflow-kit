import type { ArtifactRef } from '../../../foundation/storage/artifacts/index.js';
import type {
  EvidenceEventRef,
  RunDegradedHealth,
  RunEventCursor,
  RunProjections,
  RunReplay,
} from '../../run-lifecycle/contracts/index.js';
import type { MetricValue } from '../telemetry/index.js';

export type AnalysisTriggerKind =
  | 'terminal-lifecycle'
  | 'blocked-transition'
  | 'supervision-lost'
  | 'stale-progress'
  | 'recovery-decision';

export type AnalysisTrigger = {
  kind: AnalysisTriggerKind;
  eventRef: EvidenceEventRef;
  reason: string;
};

export type AnalysisFailureReason =
  | 'analysis-input-degraded'
  | 'analysis-artifact-unavailable'
  | 'analysis-redaction-unavailable'
  | 'analysis-rule-error'
  | 'analysis-record-unwritable'
  | 'analysis-invariant-missing';

export type RecordableAnalysisFailureReason = Exclude<AnalysisFailureReason, 'analysis-record-unwritable'>;

export interface AnalysisRequest {
  runId: string;
  trigger: AnalysisTrigger;
  evaluatedThrough: RunEventCursor;
  analyzedAt: string;
  analyzerVersion: string;
  ruleSetDigest: string;
  redactionPolicyDigest: string;
}

export interface AnalysisSnapshot {
  replay: RunReplay;
  projections: RunProjections;
  redactedArtifacts: Record<string, ArtifactRef>;
}

export interface AnalysisInputHealth {
  replayHealth: RunDegradedHealth;
  projections: 'available' | 'missing';
  artifactInputs: 'available' | 'partial' | 'unavailable';
  redaction: 'applied' | 'not-required' | 'unavailable';
}

export interface AnalysisIssue {
  issueId: string;
  code: string;
  severity: 'info' | 'attention' | 'blocked' | 'failed';
  summary: string;
  evidenceRefs: EvidenceEventRef[];
  artifactRefs: ArtifactRef[];
  metricRefs: string[];
}

export interface AnalysisResult {
  issues: AnalysisIssue[];
  metrics: Record<string, MetricValue<unknown>>;
  evidenceRefs: EvidenceEventRef[];
  reportArtifactRef?: ArtifactRef;
}

export interface AnalysisFailure {
  reason: RecordableAnalysisFailureReason;
  evidenceRefs: EvidenceEventRef[];
  artifactRefs: ArtifactRef[];
}

export type AnalysisOutcome =
  | { kind: 'recorded'; result: AnalysisResult }
  | { kind: 'failed'; failure: AnalysisFailure };
