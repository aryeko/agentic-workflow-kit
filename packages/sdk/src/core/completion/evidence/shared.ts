import type {
  AppendIntent,
  EvidenceEventRef,
  RunAppendFailure,
  RunAppendReceipt,
  RunEventEnvelope,
  RunWriter,
} from '../../run-lifecycle/contracts/index.js';
import type { ProtectedPolicySnapshotRecordedPayload } from '../contracts/index.js';

import { dedupeEvidenceEventRefs } from '../contracts/evidence-refs.js';
import type { CompletionEvaluationFailure, ProtectedPolicySnapshotInput } from './types.js';

export const toEvidenceEventRef = (event: RunEventEnvelope): EvidenceEventRef => ({
  eventId: event.eventId,
  sequence: event.sequence,
  payloadDigest: event.payloadDigest,
  type: event.type,
});

export const isEventAtOrBeforeCursor = (event: RunEventEnvelope, afterSequence: number): boolean =>
  event.sequence <= afterSequence;

export const areEvidenceRefsReplayedThroughCursor = (
  events: readonly RunEventEnvelope[],
  afterSequence: number,
  refs: readonly EvidenceEventRef[],
): boolean => {
  const replayedEventsById = new Map<string, RunEventEnvelope>();
  for (const event of events) {
    if (!isEventAtOrBeforeCursor(event, afterSequence)) {
      continue;
    }

    replayedEventsById.set(event.eventId, event);
  }

  return dedupeEvidenceEventRefs(refs).every((ref) => {
    const replayed = replayedEventsById.get(ref.eventId);
    return (
      replayed !== undefined &&
      replayed.sequence === ref.sequence &&
      replayed.type === ref.type &&
      replayed.payloadDigest === ref.payloadDigest
    );
  });
};

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

export const matchesProtectedPolicySnapshotIdentity = (
  snapshot: Pick<ProtectedPolicySnapshotRecordedPayload, 'runId' | 'policyRef' | 'baseSha'>,
  expected: Pick<ProtectedPolicySnapshotRecordedPayload, 'runId' | 'policyRef' | 'baseSha'>,
): boolean =>
  snapshot.runId === expected.runId &&
  snapshot.policyRef === expected.policyRef &&
  snapshot.baseSha === expected.baseSha;

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
  let latest: RunEventEnvelope<ProtectedPolicySnapshotRecordedPayload> | undefined;
  for (const event of events) {
    if (!isEventAtOrBeforeCursor(event, afterSequence) || event.type !== 'ProtectedPolicySnapshotRecorded') {
      continue;
    }

    if (!isProtectedPolicySnapshotPayload(event.payload)) {
      continue;
    }

    const snapshotEvent = event as RunEventEnvelope<ProtectedPolicySnapshotRecordedPayload>;
    if (latest === undefined || snapshotEvent.sequence > latest.sequence) {
      latest = snapshotEvent;
    }
  }

  return latest === undefined ? undefined : { ref: toEvidenceEventRef(latest), payload: latest.payload };
};
