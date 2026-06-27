import type { AppendIntent } from '../../run-lifecycle/contracts/index.js';
import type { ReconciliationBlockedPayload } from '../contracts/index.js';

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

  const intent: AppendIntent<ReconciliationBlockedPayload> = {
    domain: 'core-06',
    type: 'ReconciliationBlocked',
    durability: 'barrier',
    payload,
    occurredAt: input.blockedAt,
    ...(input.causationId === undefined ? {} : { causationId: input.causationId }),
  };

  const appended = input.writer.append([intent]);
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
