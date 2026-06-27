import type {
  RecoveryClassification,
  RecoveryClassifiedPayload,
  RecoveryEvidenceSnapshot,
} from '../contracts/index.js';

export const RECOVERY_CLASSIFIER_RULE_VERSION = 'recovery-rule-v1';

export const createRecoveryClassifiedPayload = (
  snapshot: RecoveryEvidenceSnapshot,
  classification: RecoveryClassification,
  classifiedAt: string,
): RecoveryClassifiedPayload => ({
  schema: 'kit-vnext.recovery-classified.v1',
  runId: snapshot.runId,
  recoveryState: classification.state,
  actionSafety: classification.actionSafety,
  recommendedAction: classification.recommendedAction,
  classifierRuleVersion: RECOVERY_CLASSIFIER_RULE_VERSION,
  cursor: snapshot.evaluatedThrough,
  evidenceRefs: classification.evidenceRefs,
  classifiedAt,
});
