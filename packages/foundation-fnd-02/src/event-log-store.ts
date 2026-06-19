import { appendFileSync, existsSync, readFileSync, statSync, truncateSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256Bytes, sha256Json } from './digest.js';
import { healthToErrorCode, storageError } from './errors.js';
import {
  fsyncDirectory,
  fsyncFile,
  logCorruptMarkerPath,
  logFilePath,
  storageKey,
  type StoragePaths,
} from './fs-utils.js';
import type { StorageRootState } from './state.js';
import type {
  AppendBatch,
  AppendReceipt,
  EventLogStore,
  FileSystemStorageRootOptions,
  LeaseCapability,
  LeaseStore,
  LogHandle,
  NonDurableAck,
  ReplayResult,
  StorageError,
  StoredRecord,
} from './types.js';
import { commitFrameSchema, recordFrameSchema, type CommitFrame, type RecordFrame } from './validation.js';

type ParsedLine =
  | {
      readonly ok: true;
      readonly value: RecordFrame | CommitFrame;
      readonly byteStart: number;
      readonly byteEnd: number;
    }
  | { readonly ok: false; readonly byteStart: number; readonly byteEnd: number; readonly hasRemainingBytes: boolean };

type FinalizedFrame<T extends RecordFrame | CommitFrame> = {
  readonly frame: T;
  readonly line: string;
};

export class FileSystemEventLogStore implements EventLogStore {
  constructor(
    private readonly paths: StoragePaths,
    private readonly state: StorageRootState,
    private readonly leases: LeaseStore,
    private readonly options: FileSystemStorageRootOptions,
  ) {}

  openForAppend(logId: string, lease: LeaseCapability): LogHandle | StorageError {
    if (!this.state.authoritativeWritesAvailable()) {
      return storageError(healthToErrorCode(this.state.health), 'event log is unavailable', this.state.health, {
        logId,
      });
    }
    if (!this.leases.fence(lease.name, lease.epoch, lease.token)) {
      return storageError('stale-writer-fenced', 'lease capability is not current', this.state.health, { logId });
    }
    const replay = this.replay(logId);
    if (replay.health === 'log-interior-corrupt') {
      return storageError('log-interior-corrupt', 'event log is interior corrupt', replay.health, { logId });
    }
    return { logId, leaseName: lease.name, epoch: lease.epoch, token: lease.token };
  }

  append(handle: LogHandle, batch: AppendBatch): AppendReceipt | NonDurableAck | StorageError {
    if (!this.state.authoritativeWritesAvailable()) {
      return storageError(healthToErrorCode(this.state.health), 'event log is unavailable', this.state.health, {
        logId: handle.logId,
      });
    }
    if (batch.payloads.length === 0 || batch.expectedSequence < 1) {
      return storageError(
        'invalid-input',
        'append requires at least one payload and a positive sequence',
        this.state.health,
      );
    }
    if (!this.leases.fence(handle.leaseName, handle.epoch, handle.token)) {
      return storageError('stale-writer-fenced', 'stale writer fenced before append', this.state.health, {
        logId: handle.logId,
        epoch: handle.epoch,
      });
    }

    const replay = this.replay(handle.logId);
    if (replay.health === 'log-interior-corrupt') {
      return storageError('log-interior-corrupt', 'event log is interior corrupt', replay.health, {
        logId: handle.logId,
      });
    }
    const expected = replay.records.length === 0 ? 1 : (replay.records.at(-1)?.sequence ?? 0) + 1;
    if (batch.expectedSequence !== expected) {
      return storageError('sequence-conflict', 'append expected sequence does not match replay', this.state.health, {
        expected,
        actual: batch.expectedSequence,
      });
    }

    const logPath = logFilePath(this.paths, handle.logId);
    const createdLog = !existsSync(logPath);
    const byteStart = createdLog ? 0 : statSync(logPath).size;
    const finalized = buildBatchFrames(handle, batch, byteStart);
    const content = finalized.map((frame) => frame.line).join('');
    try {
      appendFileSync(logPath, content);
      if (batch.durability === 'durable' || batch.durability === 'barrier') {
        fsyncFile(logPath, this.options.durabilityObserver);
      }
      if (createdLog || batch.durability === 'barrier') {
        fsyncDirectory(this.paths.logs, this.options.durabilityObserver);
      }
    } catch {
      this.state.mark('network-fs-degraded');
      return storageError('storage-unavailable', 'append could not be made durable', this.state.health, {
        logId: handle.logId,
      });
    }

    const lastFrame = finalized.at(-1);
    const firstSequence = batch.expectedSequence;
    const lastSequence = firstSequence + batch.payloads.length - 1;
    const commit = lastFrame?.frame.kind === 'commit' ? lastFrame.frame : undefined;
    if (commit === undefined) {
      return storageError('storage-unavailable', 'append failed to build commit trailer', this.state.health, {
        logId: handle.logId,
      });
    }

    if (batch.durability === 'buffered') {
      return {
        kind: 'non-durable-ack',
        logId: handle.logId,
        leaseName: handle.leaseName,
        writerEpoch: handle.epoch,
        firstSequence,
        lastSequence,
        recordCount: batch.payloads.length,
        durability: 'buffered',
        health: this.state.health,
      };
    }

    return {
      kind: 'append-receipt',
      logId: handle.logId,
      leaseName: handle.leaseName,
      writerEpoch: handle.epoch,
      firstSequence,
      lastSequence,
      byteStart,
      byteEnd: commit.byteEnd,
      recordCount: batch.payloads.length,
      batchDigest: commit.batchDigest,
      durability: batch.durability,
      health: this.state.health,
    };
  }

  replay(logId: string): ReplayResult {
    const corruptMarker = logCorruptMarkerPath(this.paths, logId);
    if (existsSync(corruptMarker)) {
      return { records: [], health: 'log-interior-corrupt' };
    }
    const logPath = logFilePath(this.paths, logId);
    if (!existsSync(logPath)) {
      return { records: [], health: this.state.health };
    }

    const parsed = parseLogBuffer(readFileSync(logPath));
    const committed: StoredRecord[] = [];
    let pending: RecordFrame[] = [];
    let committedOffset = 0;
    let expectedSequence = 1;
    let tailRepairNeeded = false;

    for (const line of parsed) {
      if (!line.ok) {
        if (line.hasRemainingBytes || pending.length > 0) {
          this.markInteriorCorrupt(logId, 'invalid frame before commit');
          return { records: [], health: 'log-interior-corrupt' };
        }
        tailRepairNeeded = true;
        break;
      }

      if (line.value.kind === 'record') {
        pending = [...pending, line.value];
        continue;
      }

      const batch = validateCommittedBatch(pending, line.value, expectedSequence);
      if (!batch.ok) {
        this.markInteriorCorrupt(logId, batch.reason);
        return { records: [], health: 'log-interior-corrupt' };
      }
      committed.push(...batch.records);
      expectedSequence = line.value.lastSequence + 1;
      committedOffset = line.value.byteEnd + 1;
      pending = [];
    }

    if (pending.length > 0 || parsed.some((line) => !line.ok)) {
      tailRepairNeeded = true;
    }
    if (tailRepairNeeded) {
      this.repairTail(logId, logPath, committedOffset);
      return { records: committed, health: 'log-tail-repaired' };
    }
    return { records: committed, health: this.state.health };
  }

  private repairTail(logId: string, logPath: string, committedOffset: number): void {
    const content = readFileSync(logPath);
    if (content.length <= committedOffset) {
      return;
    }
    const quarantinePath = join(
      this.paths.logQuarantine,
      `${storageKey(logId)}-${this.options.idGenerator.nextId('log-tail')}.tail`,
    );
    writeFileSync(quarantinePath, content.subarray(committedOffset));
    fsyncFile(quarantinePath, this.options.durabilityObserver);
    truncateSync(logPath, committedOffset);
    fsyncFile(logPath, this.options.durabilityObserver);
    fsyncDirectory(this.paths.logs, this.options.durabilityObserver);
  }

  private markInteriorCorrupt(logId: string, reason: string): void {
    const markerPath = logCorruptMarkerPath(this.paths, logId);
    writeFileSync(
      markerPath,
      `${JSON.stringify({ schema: 'kit-vnext.log-corruption.v1', logId, reason, at: this.options.clock.now().toISOString() })}\n`,
    );
    fsyncFile(markerPath, this.options.durabilityObserver);
    fsyncDirectory(this.paths.logs, this.options.durabilityObserver);
  }
}

const buildBatchFrames = (
  handle: LogHandle,
  batch: AppendBatch,
  byteStart: number,
): readonly FinalizedFrame<RecordFrame | CommitFrame>[] => {
  const frames: FinalizedFrame<RecordFrame | CommitFrame>[] = [];
  let offset = byteStart;
  let sequence = batch.expectedSequence;

  for (const payload of batch.payloads) {
    const frame = finalizeFrame<RecordFrame>(
      {
        schema: 'kit-vnext.log-frame.v1',
        kind: 'record',
        sequence,
        writerEpoch: handle.epoch,
        leaseName: handle.leaseName,
        payloadLength: payload.byteLength,
        payloadDigest: sha256Bytes(payload),
        payloadBase64: Buffer.from(payload).toString('base64'),
      },
      offset,
    );
    frames.push(frame);
    offset = frame.frame.byteEnd + 1;
    sequence += 1;
  }

  const recordFrames = frames
    .map((frame) => frame.frame)
    .filter((frame): frame is RecordFrame => frame.kind === 'record');
  const batchDigest = computeBatchDigest(recordFrames);
  const commit = finalizeFrame<CommitFrame>(
    {
      schema: 'kit-vnext.log-frame.v1',
      kind: 'commit',
      firstSequence: batch.expectedSequence,
      lastSequence: batch.expectedSequence + batch.payloads.length - 1,
      recordCount: batch.payloads.length,
      writerEpoch: handle.epoch,
      leaseName: handle.leaseName,
      recordDigests: recordFrames.map((frame) => frame.frameDigest),
      batchDigest,
    },
    offset,
  );
  return [...frames, commit];
};

const finalizeFrame = <T extends RecordFrame | CommitFrame>(
  draft: Omit<T, 'byteStart' | 'byteEnd' | 'frameDigest'>,
  byteStart: number,
): FinalizedFrame<T> => {
  let byteEnd = byteStart;
  let frameDigest = '0'.repeat(64);
  let frame = { ...draft, byteStart, byteEnd, frameDigest } as T;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const nextLineLength = Buffer.byteLength(`${JSON.stringify(frame)}\n`);
    const nextByteEnd = byteStart + nextLineLength - 1;
    const nextDigest = sha256Json({ ...draft, byteStart, byteEnd: nextByteEnd });
    const nextFrame = { ...draft, byteStart, byteEnd: nextByteEnd, frameDigest: nextDigest } as T;
    if (nextFrame.byteEnd === frame.byteEnd && nextFrame.frameDigest === frame.frameDigest) {
      return { frame: nextFrame, line: `${JSON.stringify(nextFrame)}\n` };
    }
    byteEnd = nextByteEnd;
    frameDigest = nextDigest;
    frame = { ...draft, byteStart, byteEnd, frameDigest } as T;
  }
  return { frame, line: `${JSON.stringify(frame)}\n` };
};

const computeBatchDigest = (records: readonly RecordFrame[]): string =>
  sha256Json({
    firstSequence: records[0]?.sequence,
    lastSequence: records.at(-1)?.sequence,
    recordDigests: records.map((record) => record.frameDigest),
    writerEpoch: records[0]?.writerEpoch,
    leaseName: records[0]?.leaseName,
  });

const parseLogBuffer = (buffer: Buffer): readonly ParsedLine[] => {
  const lines: ParsedLine[] = [];
  let offset = 0;
  while (offset < buffer.length) {
    const newline = buffer.indexOf(0x0a, offset);
    if (newline === -1) {
      lines.push({ ok: false, byteStart: offset, byteEnd: buffer.length - 1, hasRemainingBytes: false });
      break;
    }
    const raw = buffer.subarray(offset, newline).toString('utf8');
    try {
      const value = JSON.parse(raw) as unknown;
      const parsed =
        typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'record'
          ? recordFrameSchema.safeParse(value)
          : commitFrameSchema.safeParse(value);
      if (!parsed.success) {
        lines.push({ ok: false, byteStart: offset, byteEnd: newline, hasRemainingBytes: newline + 1 < buffer.length });
      } else {
        lines.push({ ok: true, value: parsed.data, byteStart: offset, byteEnd: newline });
      }
    } catch {
      lines.push({ ok: false, byteStart: offset, byteEnd: newline, hasRemainingBytes: newline + 1 < buffer.length });
    }
    offset = newline + 1;
  }
  return lines;
};

const validateCommittedBatch = (
  frames: readonly RecordFrame[],
  commit: CommitFrame,
  expectedSequence: number,
):
  | { readonly ok: true; readonly records: readonly StoredRecord[] }
  | { readonly ok: false; readonly reason: string } => {
  if (
    frames.length !== commit.recordCount ||
    frames.length !== commit.recordDigests.length ||
    commit.firstSequence !== expectedSequence ||
    commit.lastSequence !== expectedSequence + frames.length - 1
  ) {
    return { ok: false, reason: 'commit trailer does not match pending records' };
  }
  if (sha256Json(withoutFrameDigest(commit)) !== commit.frameDigest) {
    return { ok: false, reason: 'commit frame digest mismatch' };
  }
  if (computeBatchDigest(frames) !== commit.batchDigest) {
    return { ok: false, reason: 'batch digest mismatch' };
  }

  const records: StoredRecord[] = [];
  for (const [index, frame] of frames.entries()) {
    if (frame.sequence !== expectedSequence + index || frame.frameDigest !== commit.recordDigests[index]) {
      return { ok: false, reason: 'record sequence or digest does not match commit' };
    }
    if (sha256Json(withoutFrameDigest(frame)) !== frame.frameDigest) {
      return { ok: false, reason: 'record frame digest mismatch' };
    }
    const payload = Buffer.from(frame.payloadBase64, 'base64');
    if (payload.byteLength !== frame.payloadLength || sha256Bytes(payload) !== frame.payloadDigest) {
      return { ok: false, reason: 'payload digest or length mismatch' };
    }
    records.push({
      sequence: frame.sequence,
      writerEpoch: frame.writerEpoch,
      leaseName: frame.leaseName,
      payload,
      payloadDigest: frame.payloadDigest,
      frameDigest: frame.frameDigest,
      byteStart: frame.byteStart,
      byteEnd: frame.byteEnd,
    });
  }
  return { ok: true, records };
};

const withoutFrameDigest = <T extends RecordFrame | CommitFrame>(frame: T): Omit<T, 'frameDigest'> => {
  const { frameDigest: _frameDigest, ...rest } = frame;
  return rest;
};
