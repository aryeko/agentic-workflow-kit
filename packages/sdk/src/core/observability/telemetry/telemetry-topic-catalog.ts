import type { TelemetryTopic, TelemetryTopicCatalog, TelemetryTopicEntry } from './telemetry-topic.js';

const createTelemetryTopicEntry = (topic: TelemetryTopic, eventTypeNames: readonly string[]): TelemetryTopicEntry =>
  Object.freeze({
    topic,
    eventTypeNames: Object.freeze([...eventTypeNames]),
  });

export const TELEMETRY_TOPIC_CATALOG: TelemetryTopicCatalog = Object.freeze([
  createTelemetryTopicEntry('lifecycle', ['RunLifecycleTransitioned', 'SessionLinked']),
  createTelemetryTopicEntry('capability', ['CapabilityAttestation', 'CapabilityGateRecord']),
  createTelemetryTopicEntry('approval', ['ApprovalRequested', 'ApprovalDecisionRecorded', 'ApprovalOutcomeRecorded']),
  createTelemetryTopicEntry('liveness', ['LivenessStateChanged', 'SupervisionLost', 'WorkerTerminated']),
  createTelemetryTopicEntry('completion', [
    'CompletionDecisionRecorded',
    'MergeDecisionRecorded',
    'PostMergeOutcomeRecorded',
  ]),
  createTelemetryTopicEntry('recovery', ['RecoveryClassified', 'RecoveryActionPlanned', 'ReconciliationBlocked']),
  createTelemetryTopicEntry('provider-evidence', [
    'AgentToolObserved',
    'ForgeEvidenceCollected',
    'HostOutputCaptured',
    'WorkSourceStatusWritten',
  ]),
  createTelemetryTopicEntry('storage', ['RunLogTailRepaired', 'WorktreeLeaseCreated']),
  createTelemetryTopicEntry('privacy', ['CredentialUseDenied', 'RedactionApplied', 'CredentialMaterialDestroyed']),
  createTelemetryTopicEntry('analysis', ['AnalysisRecorded', 'AnalysisFailed']),
]);
