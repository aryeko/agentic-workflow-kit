import {
  RECOVERY_CLASSIFIER_RULE_VERSION,
  createRecoveryClassifiedPayload,
  deriveRecoveryPlanIdInput,
} from '../../../../src/core/recovery/classifier/index.js';
import { describe, expect, it } from 'vitest';

import { createPlanInput, createSnapshot } from './shared.js';

describe('core-06-s2 recovery-classified-payload-fields', () => {
  it('returns the pure RecoveryClassified payload fields without a writer dependency', () => {
    const snapshot = createSnapshot();
    const classification = {
      state: 'safe-empty-restartable',
      actionSafety: 'auto-safe',
      recommendedAction: 'restart-from-cleared-state',
      requiredGate: 'auto-recover',
      reason: 'restart is safe from an empty state',
      evidenceRefs: snapshot.evidenceRefs,
    } as const;

    expect(createRecoveryClassifiedPayload(snapshot, classification, '2026-06-27T10:30:00.000Z')).toEqual({
      schema: 'kit-vnext.recovery-classified.v1',
      runId: snapshot.runId,
      recoveryState: classification.state,
      actionSafety: classification.actionSafety,
      recommendedAction: classification.recommendedAction,
      classifierRuleVersion: RECOVERY_CLASSIFIER_RULE_VERSION,
      cursor: snapshot.evaluatedThrough,
      evidenceRefs: snapshot.evidenceRefs,
      classifiedAt: '2026-06-27T10:30:00.000Z',
    });
  });
});

describe('core-06-s2 plan-id-input-determinism', () => {
  it('derives stable digest source values from only the allowed deterministic fields', () => {
    const first = createSnapshot({ observedAt: '2026-06-27T10:10:00.000Z' });
    const second = createSnapshot({ observedAt: '2026-06-27T10:45:00.000Z' });
    const planInput = createPlanInput(first);
    const classification = { state: 'safe-empty-restartable' } as const;

    const left = deriveRecoveryPlanIdInput(planInput, classification);
    const right = deriveRecoveryPlanIdInput(createPlanInput(second), classification);

    expect(left).toEqual(right);
    expect(left.digestSource).toContain('"classificationState":"safe-empty-restartable"');
    expect(left.digestSource).not.toContain(first.observedAt);
    expect(left.digestSource).not.toContain(second.observedAt);
  });

  it('canonicalizes unsupported scope values to null in the digest source', () => {
    const snapshot = createSnapshot();
    const planInput = createPlanInput(snapshot);
    const weirdScope = {
      ...planInput.scope,
      debug: () => 'not-deterministic',
    } as unknown as typeof planInput.scope;

    const result = deriveRecoveryPlanIdInput(
      { ...planInput, scope: weirdScope },
      { state: 'operator-approval-needed' },
    );

    expect(result.digestSource).toContain('"debug":null');
  });
});
