import { describe, expect, it } from 'vitest';

import {
  planRecoveryAction,
  recordRecoveryActionApplied,
  recordRecoveryClassified,
  recordRecoveryPlan,
} from '../../../../src/core/recovery/plans/index.js';

import {
  appliedAtFixture,
  createWriterHarness,
  gateRecordFixture,
  planInputFixture,
  recoveryClassifiedPayloadFixture,
} from './shared.js';

const matrix = [
  {
    state: 'owned-session-resumable',
    requestedAction: 'resume-owned-session',
    providerControl: 'agent-resume',
    providerScope: {
      provider: 'Agent',
      scope: 'session:resume',
      freshnessKey: 'agent:resume:run-recovery-plan-01',
    },
    evidenceType: 'SessionLinked',
  },
  {
    state: 'owned-worker-stale-terminable',
    requestedAction: 'request-termination',
    providerControl: 'host-terminate',
    providerScope: {
      provider: 'Execution Host',
      scope: 'worker:termination',
      freshnessKey: 'host:terminate:run-recovery-plan-01',
    },
    evidenceType: 'HostOperationCompleted',
  },
  {
    state: 'evidence-refresh-retryable',
    requestedAction: 'retry-evidence-refresh',
    providerControl: 'forge-refresh',
    providerScope: {
      provider: 'Forge',
      scope: 'evidence:refresh',
      freshnessKey: 'forge:refresh:run-recovery-plan-01',
    },
    evidenceType: 'ForgeEvidenceCollected',
  },
  {
    state: 'safe-empty-restartable',
    requestedAction: 'restart-from-cleared-state',
    providerControl: 'work-source-release',
    providerScope: {
      provider: 'Work Source',
      scope: 'claim:release',
      freshnessKey: 'work-source:claim:run-recovery-plan-01',
    },
    evidenceType: 'ClaimReleaseRecorded',
  },
] as const;

describe('core-06-s4 recovery-action-applied-control-matrix', () => {
  for (const row of matrix) {
    it(`records ${row.providerControl} apply evidence for ${row.state}`, () => {
      const writerHarness = createWriterHarness();
      const classified = recordRecoveryClassified({
        payload: recoveryClassifiedPayloadFixture({
          state: row.state,
          recommendedAction: row.requestedAction,
          actionSafety: 'auto-safe',
          requiredGate: 'auto-recover',
          reason: `${row.requestedAction} is safe`,
          evidenceRefs: [recoveryClassifiedPayloadFixture().evidenceRefs[0]],
        }),
        writer: writerHarness.writer,
      });

      if (!classified.ok) {
        throw new Error('expected classified append to succeed');
      }

      const plan = planRecoveryAction(
        planInputFixture({
          requestedAction: row.requestedAction,
          scope: {
            runId: planInputFixture().runId,
            operationId: `recovery-plan-${row.providerControl}`,
            providerScopes: [row.providerScope],
          },
        }),
        {
          state: row.state,
          recommendedAction: row.requestedAction,
          actionSafety: 'auto-safe',
          requiredGate: 'auto-recover',
          reason: `${row.requestedAction} is safe`,
          evidenceRefs: recoveryClassifiedPayloadFixture().evidenceRefs,
        },
      );
      const planned = recordRecoveryPlan({
        runId: planInputFixture().runId,
        plan,
        plannedAt: planInputFixture().plannedAt,
        classifiedEventId: classified.value.eventId,
        writer: writerHarness.writer,
      });

      if (!planned.ok) {
        throw new Error('expected plan append to succeed');
      }

      const applied = recordRecoveryActionApplied({
        runId: planInputFixture().runId,
        committedPlan: planned.value.committedPlan,
        appliedAt: appliedAtFixture,
        evaluatedThrough: planInputFixture().evaluatedThrough,
        gateRef: gateRecordFixture({
          scope: plan.requiresGate?.scope,
          requestedAction: row.requestedAction,
        }),
        appliedControl: {
          kind: row.providerControl,
          evidenceRefs: [
            {
              eventId: `evt-${row.providerControl}`,
              sequence: 70,
              payloadDigest: `sha256:${row.providerControl}`,
              type: row.evidenceType,
            },
          ],
        },
        writer: writerHarness.writer,
      });

      expect(applied.ok).toBe(true);
      if (!applied.ok) {
        throw new Error('expected apply append to succeed');
      }
      expect(applied.value.status).toBe('applied');
      if (applied.value.status !== 'applied') {
        throw new Error('expected applied status');
      }
      expect(applied.value.payload.appliedControl).toBe(row.providerControl);
      expect(applied.value.payload.gateRef?.requestedAction).toBe(row.requestedAction);
    });
  }

  it('rejects unsupported provider controls and empty evidence refs', () => {
    const writerHarness = createWriterHarness();
    const classified = recordRecoveryClassified({
      payload: recoveryClassifiedPayloadFixture(),
      writer: writerHarness.writer,
    });

    if (!classified.ok) {
      throw new Error('expected classified append to succeed');
    }

    const plan = planRecoveryAction(planInputFixture(), {
      state: 'safe-empty-restartable',
      recommendedAction: 'restart-from-cleared-state',
      actionSafety: 'auto-safe',
      requiredGate: 'auto-recover',
      reason: 'restart is safe',
      evidenceRefs: recoveryClassifiedPayloadFixture().evidenceRefs,
    });
    const planned = recordRecoveryPlan({
      runId: planInputFixture().runId,
      plan,
      plannedAt: planInputFixture().plannedAt,
      classifiedEventId: classified.value.eventId,
      writer: writerHarness.writer,
    });

    if (!planned.ok) {
      throw new Error('expected plan append to succeed');
    }

    const unsupported = recordRecoveryActionApplied({
      runId: planInputFixture().runId,
      committedPlan: planned.value.committedPlan,
      appliedAt: appliedAtFixture,
      evaluatedThrough: planInputFixture().evaluatedThrough,
      gateRef: gateRecordFixture({
        scope: plan.requiresGate?.scope,
      }),
      appliedControl: {
        kind: 'agent-resume',
        evidenceRefs: [],
      },
      writer: writerHarness.writer,
    });

    expect(unsupported.ok).toBe(false);
    if (unsupported.ok) {
      throw new Error('expected unsupported provider control failure');
    }
    expect(unsupported.error.reason).toBe('unsupported-provider-control');
    expect(writerHarness.appendCalls).toHaveLength(2);
  });
});
