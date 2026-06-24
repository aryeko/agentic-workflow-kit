import type {
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunEventEnvelope,
  RunLifecycleState,
  RunLifecycleTransitionPayload,
  RunReplay,
  SessionLinkedPayload,
} from '../contracts/index.js';
import {
  hasContiguousSessionLinkOrdinals,
  LIFECYCLE_LEGAL_EDGE_CATALOG,
  RECOVERY_RETRY_EVIDENCE_EVENT_TYPES,
  TERMINAL_LIFECYCLE_STATE_SET,
  validateLifecycleTransition,
} from '../lifecycle/index.js';
import { reduceRunLifecycle } from '../lifecycle/lifecycle-reducer.js';
import { isLifecyclePayload } from './append-envelopes.js';
import { buildRunAppendRejected } from './append-rejected.js';
import { appendFailure } from './failures.js';
import { appendEnvelopes } from './storage.js';
import type { RunEventLogDependencies } from './types.js';

type WriterContext = {
  deps: RunEventLogDependencies;
  runId: string;
  writerEpoch: number;
  lease: Parameters<typeof appendEnvelopes>[2];
};

const TERMINAL_STATES = new Set<RunLifecycleState>(TERMINAL_LIFECYCLE_STATE_SET);
const legalEdgeMap: ReadonlyMap<string, (typeof LIFECYCLE_LEGAL_EDGE_CATALOG)[number]> = new Map(
  LIFECYCLE_LEGAL_EDGE_CATALOG.map((edge) => [`${edge.from ?? 'null'}->${edge.to}`, edge] as const),
);

const isSessionLinkedPayload = (value: unknown): value is SessionLinkedPayload =>
  Boolean(value && typeof value === 'object' && 'linkOrdinal' in value && 'sessionId' in value && 'linkRole' in value);

const referencedEvent = (
  sourceEventId: string,
  sourceEventsById: ReadonlyMap<string, RunEventEnvelope>,
  expectedType: string,
): RunEventEnvelope | undefined =>
  sourceEventsById.get(sourceEventId) ??
  (sourceEventId.startsWith(`${expectedType}:`)
    ? sourceEventsById.get(sourceEventId.slice(expectedType.length + 1))
    : undefined);

const isOwningSessionLink = (event: RunEventEnvelope): boolean =>
  event.type === 'SessionLinked' &&
  isSessionLinkedPayload(event.payload) &&
  (event.payload.linkRole === 'primary' || event.payload.linkRole === 'recovery');

const isEvidenceEvent = (event: RunEventEnvelope): boolean =>
  event.type === 'Evidence' || event.type === 'RecordedEvidence' || event.type.endsWith('Evidence');

const hasCommittedReference = (
  sourceEventIds: readonly string[],
  sourceEventsById: ReadonlyMap<string, RunEventEnvelope>,
  expectedType: string,
  predicate: (event: RunEventEnvelope) => boolean = () => true,
): boolean =>
  sourceEventIds.some((sourceEventId) => {
    const referenced = referencedEvent(sourceEventId, sourceEventsById, expectedType);
    if (referenced === undefined) {
      return false;
    }

    return (
      (expectedType === 'Evidence' ? isEvidenceEvent(referenced) : referenced.type === expectedType) &&
      predicate(referenced)
    );
  });

const hasCommittedReferenceIn = (
  sourceEventIds: readonly string[],
  sourceEventsById: ReadonlyMap<string, RunEventEnvelope>,
  expectedTypes: readonly string[],
): boolean =>
  expectedTypes.some((expectedType) => hasCommittedReference(sourceEventIds, sourceEventsById, expectedType));

const hasCommittedSourceReference = (
  from: RunLifecycleState | null,
  payload: RunLifecycleTransitionPayload,
  sourceEvents: readonly RunEventEnvelope[],
): boolean => {
  const edge = legalEdgeMap.get(`${from ?? 'null'}->${payload.to}`);
  if (!edge) {
    return false;
  }

  const sourceEventsById = new Map(sourceEvents.map((event) => [event.eventId, event] as const));
  const hasPrimaryReference =
    edge.constraint.kind === 'recovery-retry'
      ? hasCommittedReferenceIn(payload.sourceEventIds, sourceEventsById, RECOVERY_RETRY_EVIDENCE_EVENT_TYPES)
      : edge.constraint.requiredEventType === 'SessionLinked'
        ? hasCommittedReference(payload.sourceEventIds, sourceEventsById, 'SessionLinked', isOwningSessionLink)
        : hasCommittedReference(payload.sourceEventIds, sourceEventsById, edge.constraint.requiredEventType);

  if (!hasPrimaryReference) {
    return false;
  }

  if (edge.constraint.kind !== 'terminal-transition' || edge.to !== 'canceled' || payload.authority === 'operator') {
    return true;
  }

  if (payload.authority !== 'policy') {
    return false;
  }

  return hasCommittedReference(payload.sourceEventIds, sourceEventsById, 'PolicyDecision');
};

export const terminalIdempotentReceipt = (
  context: Pick<WriterContext, 'runId'>,
  replayed: RunReplay,
  envelopes: readonly RunEventEnvelope[],
): Result<RunAppendReceipt, RunAppendFailure> | undefined => {
  if (
    envelopes.length !== 1 ||
    envelopes[0].type !== 'RunLifecycleTransitioned' ||
    !isLifecyclePayload(envelopes[0].payload)
  ) {
    return undefined;
  }

  if (!TERMINAL_STATES.has(envelopes[0].payload.to)) {
    return undefined;
  }

  const matchingTerminal = replayed.events.find(
    (event) =>
      event.type === 'RunLifecycleTransitioned' &&
      isLifecyclePayload(event.payload) &&
      TERMINAL_STATES.has(event.payload.to) &&
      event.eventId === envelopes[0].eventId &&
      event.payloadDigest === envelopes[0].payloadDigest,
  );

  if (!matchingTerminal) {
    return undefined;
  }

  return {
    ok: true,
    value: {
      runId: context.runId,
      firstSequence: matchingTerminal.sequence,
      lastSequence: matchingTerminal.sequence,
      writerEpoch: matchingTerminal.writerEpoch,
      durability: matchingTerminal.durability,
      eventIds: [matchingTerminal.eventId],
      payloadDigests: [matchingTerminal.payloadDigest],
      frameDigest: `recovered:${matchingTerminal.eventId}`,
      health: replayed.health,
    },
  };
};

const lifecycleFailure = (
  context: WriterContext,
  replayed: RunReplay,
  attempted: RunEventEnvelope,
): Result<never, RunAppendFailure> => {
  const rejection = buildRunAppendRejected(context.deps, {
    runId: context.runId,
    writerEpoch: context.writerEpoch,
    sequence: replayed.lastSequence + 1,
    attempted,
    failureCode: 'illegal-lifecycle-transition',
    reason: 'Lifecycle transition is not legal from the current replayed state.',
  });
  const authored = appendEnvelopes(context.deps.eventLogStore, context.runId, context.lease, [rejection], 'durable');
  if (authored.kind === 'failure') {
    return authored.failure;
  }

  if (authored.kind === 'partial' || authored.kind === 'non-durable') {
    return appendFailure('partial-ack-unknown', 'RunAppendRejected acknowledgement was not authoritative.');
  }

  return appendFailure(
    'illegal-lifecycle-transition',
    'Lifecycle transition is not legal from the current replayed state.',
    rejection.payload,
  );
};

export const validateLifecycleAndLinkage = (
  context: WriterContext,
  replayed: RunReplay,
  envelopes: readonly RunEventEnvelope[],
): Result<void, RunAppendFailure> => {
  let lifecycle = reduceRunLifecycle(replayed.events).lifecycle;

  for (const [index, envelope] of envelopes.entries()) {
    if (envelope.type !== 'RunLifecycleTransitioned') {
      continue;
    }

    if (!isLifecyclePayload(envelope.payload)) {
      return lifecycleFailure(context, replayed, envelope);
    }

    if (lifecycle !== null && TERMINAL_STATES.has(lifecycle)) {
      return lifecycleFailure(context, replayed, envelope);
    }

    const result = validateLifecycleTransition(lifecycle, envelope.payload);
    if (!result.ok) {
      return lifecycleFailure(context, replayed, envelope);
    }

    if (!hasCommittedSourceReference(lifecycle, envelope.payload, [...replayed.events, ...envelopes.slice(0, index)])) {
      return lifecycleFailure(context, replayed, envelope);
    }

    lifecycle = envelope.payload.to;
  }

  const links = [...replayed.events, ...envelopes]
    .filter((event) => event.type === 'SessionLinked' && isSessionLinkedPayload(event.payload))
    .map((event) => event.payload as SessionLinkedPayload);

  if (!hasContiguousSessionLinkOrdinals(links)) {
    return lifecycleFailure(
      context,
      replayed,
      envelopes.find((event) => event.type === 'SessionLinked') ?? envelopes[0],
    );
  }

  return { ok: true, value: undefined };
};
