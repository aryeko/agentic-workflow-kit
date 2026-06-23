import type { LeaseCapability } from '../../../foundation/storage/index.js';
import type { AppendIntent, Result, RunAppendFailure, RunAppendReceipt, RunWriter } from '../contracts/index.js';
import { replay } from '../replay/index.js';

import { buildAppendEnvelopes, hasContiguousSequence, hasValidRequestedDurability } from './append-envelopes.js';
import { terminalIdempotentReceipt, validateLifecycleAndLinkage } from './append-validation.js';
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

export const createRunWriter = (context: WriterContext): RunWriter => ({
  append(batch: AppendIntent[]): Result<RunAppendReceipt, RunAppendFailure> {
    if (batch.length === 0) {
      return appendFailure('sequence-conflict', 'Append batch must contain at least one intent.');
    }

    if (!context.deps.leaseStore.fence(context.lease.name, context.lease.epoch, context.lease.token)) {
      return appendFailure('stale-writer-fenced', 'Writer lease no longer fences current.');
    }

    const replayed = replay(context.runId, context.deps.eventLogStore);
    if (!replayed.ok) {
      return replayFailureToAppendFailure(replayed.error);
    }

    if (!hasValidRequestedDurability(batch)) {
      return appendFailure('durability-insufficient', 'Requested durability is weaker than the event minimum.');
    }

    const { envelopes, effectiveDurability } = buildAppendEnvelopes(
      { deps: context.deps, runId: context.runId, writerEpoch: context.lease.epoch },
      batch,
      replayed.value,
    );
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
