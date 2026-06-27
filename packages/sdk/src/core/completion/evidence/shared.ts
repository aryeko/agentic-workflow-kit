import type {
  AppendIntent,
  EvidenceEventRef,
  RunAppendFailure,
  RunAppendReceipt,
  RunEventEnvelope,
  RunWriter,
} from '../../run-lifecycle/contracts/index.js';
import type { ProtectedPolicySnapshotRecordedPayload } from '../contracts/index.js';

import type { CompletionEvaluationFailure, ProtectedPolicySnapshotInput } from './types.js';

export const toEvidenceEventRef = (event: RunEventEnvelope): EvidenceEventRef => ({
  eventId: event.eventId,
  sequence: event.sequence,
  payloadDigest: event.payloadDigest,
  type: event.type,
});

export const isEventAtOrBeforeCursor = (event: RunEventEnvelope, afterSequence: number): boolean =>
  event.sequence <= afterSequence;

export const toEventLogUnwritable = (appendFailure: RunAppendFailure): CompletionEvaluationFailure => ({
  token: 'event-log-unwritable',
  appendFailure,
});

export const isProtectedPolicySnapshotPayload = (value: unknown): value is ProtectedPolicySnapshotRecordedPayload => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return (value as { schema?: string }).schema === 'kit-vnext.protected-policy-snapshot-recorded.v1';
};

export const buildProtectedPolicySnapshotPayload = (
  input: ProtectedPolicySnapshotInput,
): ProtectedPolicySnapshotRecordedPayload => ({
  schema: 'kit-vnext.protected-policy-snapshot-recorded.v1',
  runId: input.runId,
  policyRef: input.policyRef,
  policyDigest: input.policyDigest,
  baseSha: input.baseSha,
  verifierCommandDigest: input.verifierCommandDigest,
  protectedPathSets: input.protectedPathSets.map((entry) => ({
    label: entry.label,
    digest: entry.digest,
    paths: [...entry.paths],
  })),
  recordedAt: input.recordedAt,
});

export const appendBarrierEvent = async <TPayload>(
  writer: RunWriter,
  type: string,
  occurredAt: string,
  payload: TPayload,
): Promise<RunAppendReceipt | RunAppendFailure> => {
  const appendIntent: AppendIntent<TPayload> = {
    domain: 'core-05',
    type,
    durability: 'barrier',
    payload,
    occurredAt,
  };
  const result = await Promise.resolve(writer.append([appendIntent]));
  return result.ok ? result.value : result.error;
};

export const findLatestProtectedPolicySnapshot = (
  events: readonly RunEventEnvelope[],
  afterSequence: number,
): { ref: EvidenceEventRef; payload: ProtectedPolicySnapshotRecordedPayload } | undefined => {
  const snapshots = events
    .filter(
      (event) => isEventAtOrBeforeCursor(event, afterSequence) && event.type === 'ProtectedPolicySnapshotRecorded',
    )
    .filter((event): event is RunEventEnvelope<ProtectedPolicySnapshotRecordedPayload> =>
      isProtectedPolicySnapshotPayload(event.payload),
    )
    .sort((left, right) => right.sequence - left.sequence);
  const latest = snapshots[0];

  return latest === undefined ? undefined : { ref: toEvidenceEventRef(latest), payload: latest.payload };
};
