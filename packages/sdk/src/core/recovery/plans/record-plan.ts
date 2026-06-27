import type { RecoveryActionPlannedPayload } from '../contracts/index.js';

import { appendRecoveryBarrier } from './append.js';
import type { RecoveryPlanResult, RecordRecoveryPlanInput } from './types.js';

const uniqueEventIds = (eventIds: readonly string[]): readonly string[] => [...new Set(eventIds)];

export const recordRecoveryPlan = (input: RecordRecoveryPlanInput): RecoveryPlanResult => {
  const sourceEventIds = uniqueEventIds([...input.plan.sourceEventIds, input.classifiedEventId]);
  const payload: RecoveryActionPlannedPayload = {
    schema: 'kit-vnext.recovery-action-planned.v1',
    runId: input.runId,
    planId: input.plan.planId,
    selectedAction: input.plan.selectedAction,
    requiredGate: input.plan.requiresGate === undefined ? undefined : 'auto-recover',
    lifecycleTarget: input.plan.lifecycleTarget,
    providerControl: input.plan.providerControl,
    plannedAt: input.plannedAt,
    sourceEventIds,
  };

  const appended = appendRecoveryBarrier(
    input.writer,
    'RecoveryActionPlanned',
    payload,
    input.plannedAt,
    'plan',
    input.causationId,
  );
  if (!appended.ok) {
    return appended;
  }

  return {
    ok: true,
    value: {
      payload,
      appendReceipt: appended.value,
      committedPlan: {
        plan: {
          ...input.plan,
          sourceEventIds,
        },
        classifiedEventId: input.classifiedEventId,
        planEventId: appended.value.eventIds[0] ?? 'evt-recovery-plan',
      },
    },
  };
};
