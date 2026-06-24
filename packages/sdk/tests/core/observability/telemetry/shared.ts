import type { EvidenceEventRef } from '../../../../src/core/run-lifecycle/contracts/index.js';

export const expectedTelemetryTopics = [
  'lifecycle',
  'capability',
  'approval',
  'liveness',
  'completion',
  'recovery',
  'provider-evidence',
  'storage',
  'privacy',
  'analysis',
] as const;

export const expectedTelemetryCatalog = {
  lifecycle: ['RunLifecycleTransitioned', 'SessionLinked'],
  capability: ['CapabilityAttestation', 'CapabilityGateRecord'],
  approval: ['ApprovalRequested', 'ApprovalDecisionRecorded', 'ApprovalOutcomeRecorded'],
  liveness: ['LivenessStateChanged', 'SupervisionLost', 'WorkerTerminated'],
  completion: ['CompletionDecisionRecorded', 'MergeDecisionRecorded', 'PostMergeOutcomeRecorded'],
  recovery: ['RecoveryClassified', 'RecoveryActionPlanned', 'RecoveryActionApplied', 'ReconciliationBlocked'],
  'provider-evidence': ['AgentToolObserved', 'ForgeEvidenceCollected', 'HostOutputCaptured', 'WorkSourceStatusWritten'],
  storage: ['RunLogTailRepaired', 'WorktreeLeaseCreated'],
  privacy: ['CredentialUseDenied', 'RedactionApplied', 'CredentialMaterialDestroyed'],
  analysis: ['AnalysisRecorded', 'AnalysisFailed'],
} as const;

export const evidenceEventRefFixture: EvidenceEventRef = {
  eventId: 'evt-telemetry-1',
  sequence: 7,
  payloadDigest: 'sha256:telemetry',
  type: 'AnalysisRecorded',
};

export const assertNever = (_value: never): never => {
  throw new Error('unreachable');
};
