import type { LeaseCapability } from '../../../foundation/storage/index.js';
import type {
  AppendIntent,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunEventEnvelope,
  RunReplay,
  RunWriter,
} from '../contracts/index.js';
import { replay } from '../replay/index.js';

import {
  buildAppendEnvelopes,
  findInvalidRequestedDurabilityIndex,
  findMismatchedPayloadDigestIndex,
  hasContiguousSequence,
  isLifecyclePayload,
} from './append-envelopes.js';
import { buildRunAppendRejected } from './append-rejected.js';
import {
  terminalIdempotentReceipt,
  validateDeclaredPayloads,
  validateLifecycleAndLinkage,
} from './append-validation.js';
import { appendFailure, replayFailureToAppendFailure } from './failures.js';
import { recoverLostAck } from './lost-ack-recovery.js';
import { appendEnvelopes, toRunReceipt } from './storage.js';
import type { RunEventLogDependencies } from './types.js';

type WriterContext = {
  deps: RunEventLogDependencies;
  runId: string;
  lease: LeaseCapability;
};

const runWriterLeaseName = (runId: string): string => `run-writer:${runId}`;

const leaseIsCurrent = (context: WriterContext): (() => boolean) => {
  const { lease } = context;
  return () => context.deps.leaseStore.fence(lease.name, lease.epoch, lease.token);
};

const hasCanonicalCreationHistory = (replayed: RunReplay): boolean => {
  const created = replayed.events[0];
  const transitioned = replayed.events[1];

  return (
    created?.type === 'RunCreated' &&
    transitioned?.type === 'RunLifecycleTransitioned' &&
    isLifecyclePayload(transitioned.payload) &&
    transitioned.payload.from === null &&
    transitioned.payload.to === 'created' &&
    transitioned.payload.sourceEventIds.includes(created.eventId)
  );
};

const DURABILITY_INSUFFICIENT_REASON = 'Requested durability is weaker than the event minimum.';

const durabilityFailure = (
  context: WriterContext,
  replayed: RunReplay,
  attempted: RunEventEnvelope,
): Result<never, RunAppendFailure> => {
  const rejection = buildRunAppendRejected(context.deps, {
    runId: context.runId,
    writerEpoch: context.lease.epoch,
    sequence: replayed.lastSequence + 1,
    attempted,
    failureCode: 'durability-insufficient',
    reason: DURABILITY_INSUFFICIENT_REASON,
  });
  const authored = appendEnvelopes(
    context.deps.eventLogStore,
    context.runId,
    context.lease,
    [rejection],
    'durable',
    leaseIsCurrent(context),
  );
  if (authored.kind === 'failure') {
    return authored.failure;
  }

  if (authored.kind === 'partial' || authored.kind === 'non-durable') {
    return appendFailure('partial-ack-unknown', 'RunAppendRejected acknowledgement was not authoritative.');
  }

  return appendFailure('durability-insufficient', DURABILITY_INSUFFICIENT_REASON, rejection.payload);
};

const isAuthoritativeRequestedDurability = (intent: AppendIntent): boolean =>
  intent.durability === 'durable' || intent.durability === 'barrier';

export const createRunWriter = (context: WriterContext): RunWriter => ({
  append(batch: AppendIntent[]): Result<RunAppendReceipt, RunAppendFailure> {
    if (batch.length === 0) {
      return appendFailure('sequence-conflict', 'Append batch must contain at least one intent.');
    }

    if (!context.deps.leaseStore.fence(context.lease.name, context.lease.epoch, context.lease.token)) {
      return appendFailure('stale-writer-fenced', 'Writer lease no longer fences current.');
    }

    const replayed = replay(context.runId, context.deps.eventLogStore, context.deps.digestPayload);
    if (!replayed.ok) {
      return replayFailureToAppendFailure(replayed.error);
    }

    if (!hasCanonicalCreationHistory(replayed.value)) {
      return appendFailure('sequence-conflict', 'Run append requires committed creation history.');
    }

    if (findMismatchedPayloadDigestIndex(batch, context.deps.digestPayload) !== undefined) {
      return appendFailure('sequence-conflict', 'Append intent payloadDigest does not match payload.');
    }

    const { envelopes, effectiveDurability } = buildAppendEnvelopes(
      { deps: context.deps, runId: context.runId, writerEpoch: context.lease.epoch },
      batch,
      replayed.value,
    );
    const invalidDurabilityIndex = findInvalidRequestedDurabilityIndex(batch);
    if (invalidDurabilityIndex !== undefined) {
      const invalidIntent = batch[invalidDurabilityIndex];
      if (invalidIntent === undefined || !isAuthoritativeRequestedDurability(invalidIntent)) {
        return appendFailure('durability-insufficient', DURABILITY_INSUFFICIENT_REASON);
      }

      return durabilityFailure(context, replayed.value, envelopes[invalidDurabilityIndex] ?? envelopes[0]);
    }

    if (envelopes.some((event) => event.writerEpoch !== context.lease.epoch)) {
      return appendFailure('stale-writer-fenced', 'Envelope writer epoch does not match the bound lease epoch.');
    }

    const idempotent = terminalIdempotentReceipt(context, replayed.value, envelopes);
    if (idempotent) {
      return idempotent;
    }

    if (!hasContiguousSequence(envelopes, replayed.value.lastSequence + 1)) {
      return appendFailure(
        'sequence-conflict',
        'Append batch sequence must begin at the next committed sequence and be contiguous.',
      );
    }

    const declaredPayloadValidation = validateDeclaredPayloads(
      { deps: context.deps, runId: context.runId, writerEpoch: context.lease.epoch, lease: context.lease },
      replayed.value,
      envelopes,
    );
    if (!declaredPayloadValidation.ok) {
      return declaredPayloadValidation;
    }

    const semanticValidation = validateLifecycleAndLinkage(
      { deps: context.deps, runId: context.runId, writerEpoch: context.lease.epoch, lease: context.lease },
      replayed.value,
      envelopes,
    );
    if (!semanticValidation.ok) {
      return semanticValidation;
    }

    const appended = appendEnvelopes(
      context.deps.eventLogStore,
      context.runId,
      context.lease,
      envelopes,
      effectiveDurability,
      leaseIsCurrent(context),
    );
    if (appended.kind === 'receipt') {
      return {
        ok: true,
        value: toRunReceipt(context.runId, appended.receipt, effectiveDurability, envelopes, replayed.value.health),
      };
    }

    if (appended.kind === 'non-durable') {
      return appendFailure('partial-ack-unknown', 'Append acknowledgement was not authoritative.');
    }

    return appended.kind === 'partial' ? recoverLostAck(context, envelopes, effectiveDurability) : appended.failure;
  },

  renew(lease: LeaseCapability): Result<RunWriter, RunAppendFailure> {
    if (lease.name !== runWriterLeaseName(context.runId)) {
      return appendFailure('stale-writer-fenced', 'Renewed lease is not scoped to the writer run.');
    }

    if (!context.deps.leaseStore.fence(lease.name, lease.epoch, lease.token)) {
      return appendFailure('stale-writer-fenced', 'Renewed lease does not fence current.');
    }

    return {
      ok: true,
      value: createRunWriter({ ...context, lease }),
    };
  },
});
