import type { MergeIntentPayload } from '../contracts/index.js';

import { appendBarrierIntent } from './shared.js';
import type { IntentsDependencies, MergeIntentResult, RecordMergeIntentInput } from './types.js';

export const recordMergeIntent = async (
  input: RecordMergeIntentInput,
  dependencies: IntentsDependencies,
): MergeIntentResult => {
  const decision = input.mergeDecision.decision;
  if (decision.state !== 'merge-ready') {
    return { ok: false, error: { token: decision.state } };
  }

  if (decision.headSha.length === 0) {
    return { ok: false, error: { token: 'merge-head-ambiguous' } };
  }

  if (
    input.gateEventId === undefined ||
    decision.gateRef === undefined ||
    decision.gateRef.decision !== 'allow' ||
    decision.gateRef.policyRef !== input.policyRef
  ) {
    return { ok: false, error: { token: 'merge-capability-denied' } };
  }

  if (decision.gateRef.scope.expectedHeadSha !== decision.headSha) {
    return { ok: false, error: { token: 'merge-head-ambiguous' } };
  }

  const payload: MergeIntentPayload = {
    schema: 'kit-vnext.merge-intent-recorded.v1',
    runId: input.runId,
    operation: input.operation,
    expectedHeadSha: decision.headSha,
    policyRef: input.policyRef,
    gateEventId: input.gateEventId,
    mergeDecisionEventId: input.mergeDecision.eventId,
    recordedAt: input.recordedAt,
  };

  const appendResult = await appendBarrierIntent(dependencies.writer, 'MergeIntentRecorded', input.recordedAt, payload);
  if (!appendResult.ok) {
    return {
      ok: false,
      error: {
        token: 'merge-intent-unwritable',
        appendFailure: appendResult.error,
      },
    };
  }

  return {
    ok: true,
    value: {
      intent: payload,
      intentEventId: appendResult.value.eventIds[0] ?? 'MergeIntentRecorded',
      appendReceipt: appendResult.value,
    },
  };
};
