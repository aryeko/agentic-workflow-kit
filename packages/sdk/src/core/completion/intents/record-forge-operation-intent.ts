import type { ForgeOperationIntentPayload } from '../contracts/index.js';

import { appendBarrierIntent, resolveExactHead, uniqueEvidenceRefs } from './shared.js';
import type { ForgeOperationIntentResult, IntentsDependencies, RecordForgeOperationIntentInput } from './types.js';

export const recordForgeOperationIntent = async (
  input: RecordForgeOperationIntentInput,
  dependencies: IntentsDependencies,
): ForgeOperationIntentResult => {
  const exactHead = resolveExactHead(input.expectedHeadSha, input.localHead, 'head-ambiguous');
  if (!exactHead.ok) {
    return { ok: false, error: { token: exactHead.token } };
  }

  const payload: ForgeOperationIntentPayload = {
    schema: 'kit-vnext.forge-operation-intent-recorded.v1',
    runId: input.runId,
    operation: input.operation,
    expectedHeadSha: exactHead.expectedHeadSha,
    policyRef: input.policyRef,
    decisionEventId: input.decisionEventId,
    evidenceRefs: uniqueEvidenceRefs([...(input.localHead.evidenceRefs ?? []), ...input.evidenceRefs]),
    ...(input.purpose === undefined ? {} : { purpose: input.purpose }),
    ...(input.blockerState === undefined ? {} : { blockerState: input.blockerState }),
    recordedAt: input.recordedAt,
  };

  const appendResult = await appendBarrierIntent(
    dependencies.writer,
    'ForgeOperationIntentRecorded',
    input.recordedAt,
    payload,
  );
  if (!appendResult.ok) {
    return {
      ok: false,
      error: {
        token: 'event-log-unwritable',
        appendFailure: appendResult.error,
      },
    };
  }

  return {
    ok: true,
    value: {
      intent: payload,
      intentEventId: appendResult.value.eventIds[0] ?? 'ForgeOperationIntentRecorded',
      appendReceipt: appendResult.value,
    },
  };
};
