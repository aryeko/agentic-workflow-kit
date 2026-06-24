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
import { hasValidDeclaredPayload } from '../replay/payload-validator.js';
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
  const terminalEnvelope = envelopes.find(
    (event) =>
      event.type === 'RunLifecycleTransitioned' &&
      isLifecyclePayload(event.payload) &&
      TERMINAL_STATES.has(event.payload.to),
  );

  if (terminalEnvelope === undefined || !isLifecyclePayload(terminalEnvelope.payload)) {
    return undefined;
  }

  const matchingTerminal = replayed.events.find(
    (event) =>
      event.type === 'RunLifecycleTransitioned' &&
      isLifecyclePayload(event.payload) &&
      TERMINAL_STATES.has(event.payload.to) &&
      event.eventId === terminalEnvelope.eventId &&
      event.payloadDigest === terminalEnvelope.payloadDigest,
  );

  if (!matchingTerminal) {
    return undefined;
  }

  const unmatched = [...replayed.events];
  const matchingEvents: RunEventEnvelope[] = [];
  for (const envelope of envelopes) {
    const matchIndex = unmatched.findIndex(
      (event) =>
        event.type === envelope.type &&
        event.eventId === envelope.eventId &&
        event.payloadDigest === envelope.payloadDigest,
    );
    if (matchIndex === -1) {
      return undefined;
    }

    const [matched] = unmatched.splice(matchIndex, 1);
    matchingEvents.push(matched);
  }

  const orderedMatches = [...matchingEvents].sort((left, right) => left.sequence - right.sequence);
  const firstMatch = orderedMatches[0];
  const lastMatch = orderedMatches.at(-1);
  if (firstMatch === undefined || lastMatch === undefined) {
    return undefined;
  }

  return {
    ok: true,
    value: {
      runId: context.runId,
      firstSequence: firstMatch.sequence,
      lastSequence: lastMatch.sequence,
      writerEpoch: matchingTerminal.writerEpoch,
      durability: matchingTerminal.durability,
      eventIds: matchingEvents.map((event) => event.eventId),
      payloadDigests: matchingEvents.map((event) => event.payloadDigest),
      frameDigest: `recovered:${firstMatch.sequence}-${lastMatch.sequence}`,
      health: replayed.health,
    },
  };
};

const semanticFailure = (
  context: WriterContext,
  replayed: RunReplay,
  attempted: RunEventEnvelope,
  reason: string,
): Result<never, RunAppendFailure> => {
  const rejection = buildRunAppendRejected(context.deps, {
    runId: context.runId,
    writerEpoch: context.writerEpoch,
    sequence: replayed.lastSequence + 1,
    attempted,
    failureCode: 'illegal-lifecycle-transition',
    reason,
  });
  const authored = appendEnvelopes(
    context.deps.eventLogStore,
    context.runId,
    context.lease,
    [rejection],
    'durable',
    () => context.deps.leaseStore.fence(context.lease.name, context.lease.epoch, context.lease.token),
  );
  if (authored.kind === 'failure') {
    return authored.failure;
  }

  if (authored.kind === 'partial' || authored.kind === 'non-durable') {
    return appendFailure('partial-ack-unknown', 'RunAppendRejected acknowledgement was not authoritative.');
  }

  return appendFailure('illegal-lifecycle-transition', reason, rejection.payload);
};

const lifecycleFailure = (
  context: WriterContext,
  replayed: RunReplay,
  attempted: RunEventEnvelope,
): Result<never, RunAppendFailure> =>
  semanticFailure(context, replayed, attempted, 'Lifecycle transition is not legal from the current replayed state.');

export const validateDeclaredPayloads = (
  context: WriterContext,
  replayed: RunReplay,
  envelopes: readonly RunEventEnvelope[],
): Result<void, RunAppendFailure> => {
  const invalid = envelopes.find((envelope) => !hasValidDeclaredPayload(envelope));
  if (invalid !== undefined) {
    return semanticFailure(context, replayed, invalid, 'Declared event payload is malformed.');
  }

  return { ok: true, value: undefined };
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
