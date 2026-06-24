import type {
  AppendIntent,
  RunDurabilityClass,
  RunEventEnvelope,
  RunLifecycleState,
  RunLifecycleTransitionPayload,
  RunReplay,
} from '../contracts/index.js';
import { TERMINAL_LIFECYCLE_STATE_SET } from '../lifecycle/index.js';
import { LIFECYCLE_LEGAL_EDGE_CATALOG } from '../lifecycle/transition-table.js';
import { isLifecycleTransitionPayload } from '../replay/payload-validator.js';
import type { RunEventLogDependencies } from './types.js';

type WriterBinding = {
  deps: RunEventLogDependencies;
  runId: string;
  writerEpoch: number;
};

type IntentMetadata = {
  sequence?: number;
  writerEpoch?: number;
};

export type BuiltAppend = {
  envelopes: RunEventEnvelope[];
  effectiveDurability: RunDurabilityClass;
};

const TERMINAL_STATES = new Set<RunLifecycleState>(TERMINAL_LIFECYCLE_STATE_SET);

export const isLifecyclePayload = isLifecycleTransitionPayload;

const strongestDurability = (batch: readonly AppendIntent[]): RunDurabilityClass =>
  batch.some((intent) => intent.durability === 'barrier') ? 'barrier' : 'durable';

const transitionRequiresBarrier = (payload: RunLifecycleTransitionPayload): boolean => {
  if (payload.to === 'configured' || payload.to === 'task-snapshotted' || TERMINAL_STATES.has(payload.to)) {
    return true;
  }

  return LIFECYCLE_LEGAL_EDGE_CATALOG.some(
    (edge) => edge.from === payload.from && edge.to === payload.to && edge.constraint.requiresBarrier,
  );
};

const requiresBarrier = (intent: AppendIntent): boolean => {
  if (intent.type === 'RunCreated' || intent.type === 'RunPolicyBound' || intent.type === 'TaskSnapshotRecorded') {
    return true;
  }

  if (
    intent.type === 'SessionLinked' ||
    intent.type === 'SessionLinkSuperseded' ||
    intent.type === 'RunLogTailRepaired'
  ) {
    return true;
  }

  return intent.type === 'RunLifecycleTransitioned' && isLifecyclePayload(intent.payload)
    ? transitionRequiresBarrier(intent.payload)
    : false;
};

export const hasValidRequestedDurability = (batch: readonly AppendIntent[]): boolean =>
  findInvalidRequestedDurabilityIndex(batch) === undefined;

export const findInvalidRequestedDurabilityIndex = (batch: readonly AppendIntent[]): number | undefined => {
  const invalidIndex = batch.findIndex((intent) => {
    if (intent.durability !== 'durable' && intent.durability !== 'barrier') {
      return true;
    }

    return requiresBarrier(intent) && intent.durability !== 'barrier';
  });

  return invalidIndex === -1 ? undefined : invalidIndex;
};

export const findMismatchedPayloadDigestIndex = (
  batch: readonly AppendIntent[],
  digestPayload: RunEventLogDependencies['digestPayload'],
): number | undefined => {
  const invalidIndex = batch.findIndex((intent) => {
    if (intent.payloadDigest === undefined) {
      return false;
    }

    return intent.payloadDigest !== digestPayload(intent.payload);
  });

  return invalidIndex === -1 ? undefined : invalidIndex;
};

const makeEnvelope = (
  binding: WriterBinding,
  intent: AppendIntent,
  sequence: number,
  effectiveDurability: RunDurabilityClass,
): RunEventEnvelope => {
  const metadata = intent as IntentMetadata;
  const envelopeSequence = metadata.sequence ?? sequence;
  return {
    schema: 'kit-vnext.run-event.v1',
    runId: binding.runId,
    eventId:
      intent.eventId ??
      binding.deps.createEventId({ runId: binding.runId, type: intent.type, sequence: envelopeSequence }),
    sequence: envelopeSequence,
    writerEpoch: metadata.writerEpoch ?? binding.writerEpoch,
    domain: intent.domain,
    type: intent.type,
    durability: effectiveDurability,
    occurredAt: intent.occurredAt,
    recordedAt: binding.deps.now(),
    payloadDigest: intent.payloadDigest ?? binding.deps.digestPayload(intent.payload),
    payload: intent.payload,
    causationId: intent.causationId,
    correlationId: intent.correlationId,
    artifactRefs: intent.artifactRefs,
  };
};

export const buildAppendEnvelopes = (
  binding: WriterBinding,
  batch: readonly AppendIntent[],
  replayed: RunReplay,
): BuiltAppend => {
  const effectiveDurability = strongestDurability(batch);
  const startSequence = replayed.lastSequence + 1;
  return {
    effectiveDurability,
    envelopes: batch.map((intent, index) => makeEnvelope(binding, intent, startSequence + index, effectiveDurability)),
  };
};

export const hasContiguousSequence = (events: readonly RunEventEnvelope[], expectedStart: number): boolean =>
  events.every((event, index) => event.sequence === expectedStart + index);
