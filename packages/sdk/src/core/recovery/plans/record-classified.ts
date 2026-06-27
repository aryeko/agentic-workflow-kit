import type { RecoveryClassifiedResult, RecordRecoveryClassifiedInput } from './types.js';
import { appendRecoveryBarrier } from './append.js';

export const recordRecoveryClassified = (input: RecordRecoveryClassifiedInput): RecoveryClassifiedResult => {
  const appended = appendRecoveryBarrier(
    input.writer,
    'RecoveryClassified',
    input.payload,
    input.payload.classifiedAt,
    'classified',
    input.causationId,
  );
  if (!appended.ok) {
    return appended;
  }

  return {
    ok: true,
    value: {
      payload: input.payload,
      appendReceipt: appended.value,
      eventId: appended.value.eventIds[0] ?? 'evt-recovery-classified',
    },
  };
};
