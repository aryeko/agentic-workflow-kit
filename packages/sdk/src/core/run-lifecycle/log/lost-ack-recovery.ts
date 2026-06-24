import type {
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunDurabilityClass,
  RunEventEnvelope,
} from '../contracts/index.js';
import { replay } from '../replay/index.js';

import { appendFailure, replayFailureToAppendFailure } from './failures.js';
import { appendEnvelopes, toRunReceipt } from './storage.js';
import type { RunEventLogDependencies } from './types.js';

type RecoveryContext = {
  deps: RunEventLogDependencies;
  runId: string;
  lease: Parameters<typeof appendEnvelopes>[2];
};

export const recoverLostAck = (
  context: RecoveryContext,
  envelopes: readonly RunEventEnvelope[],
  durability: RunDurabilityClass,
): Result<RunAppendReceipt, RunAppendFailure> => {
  const replayed = replay(context.runId, context.deps.eventLogStore, context.deps.digestPayload);
  if (!replayed.ok) {
    return replayFailureToAppendFailure(replayed.error);
  }

  const firstSequence = envelopes[0].sequence;
  const lastSequence = envelopes[envelopes.length - 1].sequence;
  const observed = replayed.value.events.filter(
    (event) => event.sequence >= firstSequence && event.sequence <= lastSequence,
  );

  if (
    observed.length === envelopes.length &&
    observed.every(
      (event, index) =>
        event.eventId === envelopes[index].eventId && event.payloadDigest === envelopes[index].payloadDigest,
    )
  ) {
    return {
      ok: true,
      value: {
        runId: context.runId,
        firstSequence,
        lastSequence,
        writerEpoch: context.lease.epoch,
        durability,
        eventIds: envelopes.map((event) => event.eventId),
        payloadDigests: envelopes.map((event) => event.payloadDigest),
        frameDigest: `recovered:${firstSequence}-${lastSequence}`,
        health: replayed.value.health,
      },
    };
  }

  if (observed.length === 0 && replayed.value.lastSequence < firstSequence) {
    if (!context.deps.leaseStore.fence(context.lease.name, context.lease.epoch, context.lease.token)) {
      return appendFailure('stale-writer-fenced', 'Writer lease no longer fences current after lost-ack replay.');
    }

    const freshAppend = appendEnvelopes(
      context.deps.eventLogStore,
      context.runId,
      context.lease,
      envelopes,
      durability,
      () => context.deps.leaseStore.fence(context.lease.name, context.lease.epoch, context.lease.token),
    );
    if (freshAppend.kind === 'receipt') {
      return {
        ok: true,
        value: toRunReceipt(context.runId, freshAppend.receipt, durability, envelopes, replayed.value.health),
      };
    }

    return freshAppend.kind === 'partial' || freshAppend.kind === 'non-durable'
      ? appendFailure('partial-ack-unknown', 'Append acknowledgement was not authoritative.')
      : freshAppend.failure;
  }

  return appendFailure(
    'sequence-conflict',
    'Lost acknowledgement replay found a conflicting event id or payload digest.',
  );
};
