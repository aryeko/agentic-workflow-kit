import type {
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunEventEnvelope,
  RunLifecycleState,
  RunReplay,
  SessionLinkedPayload,
} from '../contracts/index.js';
import {
  hasContiguousSessionLinkOrdinals,
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

const isSessionLinkedPayload = (value: unknown): value is SessionLinkedPayload =>
  Boolean(value && typeof value === 'object' && 'linkOrdinal' in value && 'sessionId' in value && 'linkRole' in value);

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

  for (const envelope of envelopes) {
    if (envelope.type !== 'RunLifecycleTransitioned' || !isLifecyclePayload(envelope.payload)) {
      continue;
    }

    if (lifecycle !== null && TERMINAL_STATES.has(lifecycle)) {
      return lifecycleFailure(context, replayed, envelope);
    }

    const result = validateLifecycleTransition(lifecycle, envelope.payload);
    if (!result.ok) {
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
