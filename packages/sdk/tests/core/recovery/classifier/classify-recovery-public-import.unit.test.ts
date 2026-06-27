import type { RecoveryActionSafety, RecoveryClassification, RecoveryClassifiedPayload, RecoveryPlanIdInput } from 'sdk';
import {
  RECOVERY_CLASSIFIER_RULE_VERSION,
  classifyActionSafety,
  classifyRecovery,
  createRecoveryClassifiedPayload,
  deriveRecoveryPlanIdInput,
} from 'sdk';
import { describe, expect, it } from 'vitest';

import { createPlanInput, createSnapshot } from './shared.js';

describe('core-06-s2 public sdk exports', () => {
  it('imports the recovery classifier helpers from the sdk entrypoint', () => {
    const snapshot = createSnapshot();
    const classification: RecoveryClassification = classifyRecovery(snapshot);
    const actionSafety: RecoveryActionSafety = classifyActionSafety(classification.state);
    const payload: RecoveryClassifiedPayload = createRecoveryClassifiedPayload(
      snapshot,
      classification,
      '2026-06-27T10:30:00.000Z',
    );
    const planIdInput: RecoveryPlanIdInput = deriveRecoveryPlanIdInput(createPlanInput(snapshot), classification);

    expect(actionSafety.recommendedAction).toBe(classification.recommendedAction);
    expect(payload.classifierRuleVersion).toBe(RECOVERY_CLASSIFIER_RULE_VERSION);
    expect(planIdInput.classificationState).toBe(classification.state);
  });
});
