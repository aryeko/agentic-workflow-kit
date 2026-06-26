import { appendSupervisionLost, ensureCoreFactAppendAllowed } from './shared.js';
import type { RecordSupervisionLostInput, RecordSupervisionLostResult, SupervisionFactWriter } from './types.js';

export const recordSupervisionLost = async (
  input: RecordSupervisionLostInput,
  writer: SupervisionFactWriter,
): Promise<RecordSupervisionLostResult> => {
  const { guard, ...payloadInput } = input;
  const allowed = ensureCoreFactAppendAllowed(guard);
  if (!allowed.ok) {
    return allowed;
  }

  return appendSupervisionLost(writer, {
    runId: payloadInput.runId,
    reason: payloadInput.reason,
    lostAt: payloadInput.lostAt,
    sourceEventIds: payloadInput.sourceEventIds,
  });
};
