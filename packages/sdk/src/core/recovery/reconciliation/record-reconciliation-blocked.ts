import type { ReconciliationBlockedPayload } from '../contracts/index.js';

import { buildRecoveryBarrierIntent } from '../shared/barrier-intent.js';
import type { RecordReconciliationBlockedInput, RecordReconciliationBlockedResult } from './types.js';

export const recordReconciliationBlocked = (
  input: RecordReconciliationBlockedInput,
): RecordReconciliationBlockedResult => {
  const payload: ReconciliationBlockedPayload = {
    schema: 'kit-vnext.reconciliation-blocked.v1',
    runId: input.classified.runId,
    recoveryState: input.classified.recoveryState,
    parkedReason: input.parkedReason,
    severity: input.severity,
    evidenceRefs: input.classified.evidenceRefs,
    cursor: input.classified.cursor,
    blockedAt: input.blockedAt,
  };

  const appended = input.writer.append([
    buildRecoveryBarrierIntent('ReconciliationBlocked', payload, input.blockedAt, input.causationId),
  ]);
  if (!appended.ok) {
    return {
      ok: false,
      error: {
        reason: 'log-unwritable',
        phase: 'apply',
        appendFailure: appended.error,
      },
    };
  }

  return {
    ok: true,
    value: {
      payload,
      appendReceipt: appended.value,
      eventId: appended.value.eventIds[0] ?? 'evt-reconciliation-blocked',
    },
  };
};
