import type { StorageError } from '../errors/index.js';
import { requireAuthoritativeStorageOperation, type StorageHealth } from '../health/index.js';
import type {
  AppendBatch,
  AppendReceipt,
  ByteRange,
  EventLogLeaseBinding,
  EventLogStore,
  LogHandle,
  NonDurableAck,
  ReplayResult,
  StoredRecord,
} from './event-log-types.js';

const DEFAULT_RECORD_FRAME_OVERHEAD_BYTES = 16;
const DEFAULT_COMMIT_TRAILER_BYTES = 8;

const textEncoder = new TextEncoder();

type DigestBytes = (bytes: Uint8Array) => string;

type WriterBinding = {
  readonly leaseName: string;
  readonly epoch: number;
  readonly token: string;
};

type LogState = {
  readonly committed: readonly StoredRecord[];
  readonly buffered: readonly StoredRecord[];
  readonly currentWriter?: WriterBinding;
  readonly nextSequence: number;
  readonly nextByteOffset: number;
  readonly quarantinedTailBytes?: Uint8Array;
  readonly interiorCorrupt: boolean;
};

type StoreState = {
  readonly health: StorageHealth;
  readonly logs: Readonly<Record<string, LogState>>;
};

export type InMemoryEventLogStoreOptions = {
  readonly digestBytes: DigestBytes;
  readonly initialHealth?: StorageHealth;
  readonly recordFrameOverheadBytes?: number;
  readonly commitTrailerBytes?: number;
};

export type InMemoryEventLogStore = EventLogStore & {
  setStorageHealth(health: StorageHealth): void;
  injectTailBytes(logId: string, tailBytes: Uint8Array): void;
  markInteriorCorrupt(logId: string): void;
};

const createStorageError = (code: StorageError['code'], health: StorageHealth, message: string): StorageError => ({
  code,
  health,
  message,
});

const cloneBytes = (payload: Uint8Array): Uint8Array => new Uint8Array(payload);

const cloneRecord = (record: StoredRecord): StoredRecord => ({
  ...record,
  byteRange: { ...record.byteRange },
  payload: cloneBytes(record.payload),
});

const emptyLogState = (): LogState => ({
  committed: [],
  buffered: [],
  nextSequence: 1,
  nextByteOffset: 0,
  interiorCorrupt: false,
});

const encodeNumber = (value: number): Uint8Array => textEncoder.encode(String(value));

const encodeString = (value: string): Uint8Array => textEncoder.encode(value);

const joinBytes = (chunks: readonly Uint8Array[]): Uint8Array => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const joined = new Uint8Array(totalLength);
  let offset = 0;

  for (const chunk of chunks) {
    joined.set(chunk, offset);
    offset += chunk.length;
  }

  return joined;
};

const buildFrameSeed = (
  binding: WriterBinding,
  sequence: number,
  payload: Uint8Array,
  byteRange: ByteRange,
): Uint8Array =>
  joinBytes([
    encodeString('seq:'),
    encodeNumber(sequence),
    encodeString('|epoch:'),
    encodeNumber(binding.epoch),
    encodeString('|lease:'),
    encodeString(binding.leaseName),
    encodeString('|start:'),
    encodeNumber(byteRange.start),
    encodeString('|end:'),
    encodeNumber(byteRange.end),
    encodeString('|payload:'),
    payload,
  ]);

const buildTrailerSeed = (lastSequence: number, durability: AppendBatch['durability']): Uint8Array =>
  joinBytes([
    encodeString('commit:'),
    encodeNumber(lastSequence),
    encodeString('|durability:'),
    encodeString(durability),
  ]);

const buildBufferedAck = (expectedSequence: number): NonDurableAck => ({
  acknowledged: true,
  durability: 'buffered',
  expectedSequence,
});

const getLogState = (state: StoreState, logId: string): LogState => state.logs[logId] ?? emptyLogState();

const mapLogs = (state: StoreState, mapper: (logId: string, logState: LogState) => LogState): StoreState => {
  const nextEntries = Object.entries(state.logs).map(([logId, logState]) => [logId, mapper(logId, logState)] as const);

  return {
    ...state,
    logs: Object.fromEntries(nextEntries),
  };
};

const updateLogState = (state: StoreState, logId: string, updater: (logState: LogState) => LogState): StoreState => {
  const current = getLogState(state, logId);

  return {
    ...state,
    logs: {
      ...state.logs,
      [logId]: updater(current),
    },
  };
};

const writerMatches = (binding: WriterBinding | undefined, handle: LogHandle): boolean =>
  binding !== undefined &&
  binding.leaseName === handle.leaseName &&
  binding.epoch === handle.epoch &&
  binding.token === handle.token;

const collectReceiptPayloadDigest = (records: readonly StoredRecord[], digestBytes: DigestBytes): string =>
  digestBytes(joinBytes(records.map((record) => cloneBytes(record.payload))));

const collectReceiptFrameDigest = (
  records: readonly StoredRecord[],
  durability: AppendBatch['durability'],
  digestBytes: DigestBytes,
): string =>
  digestBytes(
    joinBytes([
      ...records.map((record) =>
        joinBytes([
          encodeNumber(record.sequence),
          encodeString(':'),
          encodeString(record.frameDigest),
          encodeString('|'),
        ]),
      ),
      buildTrailerSeed(records[records.length - 1]?.sequence ?? 0, durability),
    ]),
  );

const allocateRecords = (
  logState: LogState,
  binding: WriterBinding,
  payloads: readonly Uint8Array[],
  digestBytes: DigestBytes,
  recordFrameOverheadBytes: number,
): {
  readonly records: readonly StoredRecord[];
  readonly nextSequence: number;
  readonly nextByteOffset: number;
} => {
  let nextSequence = logState.nextSequence;
  let nextByteOffset = logState.nextByteOffset;
  const records: StoredRecord[] = [];

  for (const payloadInput of payloads) {
    const payload = cloneBytes(payloadInput);
    const payloadLength = payload.length;
    const byteRange = {
      start: nextByteOffset,
      end: nextByteOffset + recordFrameOverheadBytes + payloadLength,
    };
    const payloadDigest = digestBytes(payload);
    const frameDigest = digestBytes(buildFrameSeed(binding, nextSequence, payload, byteRange));

    records.push({
      sequence: nextSequence,
      writerEpoch: binding.epoch,
      leaseName: binding.leaseName,
      payloadLength,
      payloadDigest,
      frameDigest,
      byteRange,
      payload,
    });

    nextSequence += 1;
    nextByteOffset = byteRange.end;
  }

  return {
    records,
    nextSequence,
    nextByteOffset,
  };
};

const replayHealthForLog = (storeHealth: StorageHealth, logState: LogState): StorageHealth => {
  if (storeHealth !== 'ok') {
    return storeHealth;
  }

  if (logState.interiorCorrupt) {
    return 'log-interior-corrupt';
  }

  if (logState.quarantinedTailBytes !== undefined && logState.quarantinedTailBytes.length > 0) {
    return 'log-tail-repaired';
  }

  return 'ok';
};

export const createInMemoryEventLogStore = (options: InMemoryEventLogStoreOptions): InMemoryEventLogStore => {
  const digestBytes = options.digestBytes;
  const recordFrameOverheadBytes = options.recordFrameOverheadBytes ?? DEFAULT_RECORD_FRAME_OVERHEAD_BYTES;
  const commitTrailerBytes = options.commitTrailerBytes ?? DEFAULT_COMMIT_TRAILER_BYTES;

  let state: StoreState = {
    health: options.initialHealth ?? 'ok',
    logs: {},
  };

  const guardAuthoritativeAppend = (): true | StorageError => {
    const availability = requireAuthoritativeStorageOperation(state.health, 'append');

    return availability.ok ? true : availability.error;
  };

  return {
    openForAppend(logId: string, lease: EventLogLeaseBinding): LogHandle | StorageError {
      const appendAvailability = guardAuthoritativeAppend();

      if (appendAvailability !== true) {
        return appendAvailability;
      }

      const handle: LogHandle = {
        logId,
        leaseName: lease.name,
        epoch: lease.epoch,
        token: lease.token,
      };

      state = updateLogState(state, logId, (logState) => ({
        ...logState,
        currentWriter: {
          leaseName: lease.name,
          epoch: lease.epoch,
          token: lease.token,
        },
      }));

      return handle;
    },

    append(handle: LogHandle, batch: AppendBatch): AppendReceipt | NonDurableAck | StorageError {
      const appendAvailability = guardAuthoritativeAppend();

      if (appendAvailability !== true) {
        return appendAvailability;
      }

      const logState = getLogState(state, handle.logId);
      const replayHealth = replayHealthForLog(state.health, logState);

      if (logState.interiorCorrupt) {
        return createStorageError(
          'log-interior-corrupt',
          replayHealth,
          `Committed history is incoherent for log ${handle.logId}; append is read-only.`,
        );
      }

      if (handle.leaseName.length === 0 || handle.token.length === 0) {
        return createStorageError(
          'stale-writer-fenced',
          replayHealth,
          'Append handle must include a lease name and token before bytes can be appended.',
        );
      }

      if (!writerMatches(logState.currentWriter, handle)) {
        return createStorageError(
          'stale-writer-fenced',
          replayHealth,
          `Append handle no longer matches the current lease binding for log ${handle.logId}.`,
        );
      }

      if (batch.payloads.length === 0) {
        return createStorageError(
          'stale-writer-fenced',
          replayHealth,
          `Append batch for log ${handle.logId} must contain at least one payload.`,
        );
      }

      if (batch.expectedSequence !== logState.nextSequence) {
        return createStorageError(
          'stale-writer-fenced',
          replayHealth,
          `Expected sequence ${batch.expectedSequence} does not match next append sequence ${logState.nextSequence} for log ${handle.logId}.`,
        );
      }

      const binding = logState.currentWriter;

      if (binding === undefined) {
        return createStorageError(
          'stale-writer-fenced',
          replayHealth,
          `Append handle no longer matches the current lease binding for log ${handle.logId}.`,
        );
      }

      const allocated = allocateRecords(logState, binding, batch.payloads, digestBytes, recordFrameOverheadBytes);

      if (batch.durability === 'buffered') {
        state = updateLogState(state, handle.logId, (currentLogState) => ({
          ...currentLogState,
          buffered: [...currentLogState.buffered, ...allocated.records],
          nextSequence: allocated.nextSequence,
          nextByteOffset: allocated.nextByteOffset,
        }));

        return buildBufferedAck(batch.expectedSequence);
      }

      const durableRecords = [...logState.buffered, ...allocated.records];
      const firstRecord = durableRecords[0];
      const lastRecord = durableRecords[durableRecords.length - 1];

      state = updateLogState(state, handle.logId, (currentLogState) => ({
        ...currentLogState,
        committed: [...currentLogState.committed, ...currentLogState.buffered, ...allocated.records],
        buffered: [],
        nextSequence: allocated.nextSequence,
        nextByteOffset: allocated.nextByteOffset,
      }));

      return {
        firstSequence: firstRecord.sequence,
        lastSequence: lastRecord.sequence,
        writerEpoch: handle.epoch,
        leaseName: handle.leaseName,
        durability: batch.durability,
        byteRange: {
          start: firstRecord.byteRange.start,
          end: lastRecord.byteRange.end + commitTrailerBytes,
        },
        payloadDigest: collectReceiptPayloadDigest(durableRecords, digestBytes),
        frameDigest: collectReceiptFrameDigest(durableRecords, batch.durability, digestBytes),
      };
    },

    replay(logId: string): ReplayResult {
      const logState = getLogState(state, logId);

      return {
        health: replayHealthForLog(state.health, logState),
        records: logState.committed.map(cloneRecord),
      };
    },

    setStorageHealth(health: StorageHealth): void {
      state = {
        ...mapLogs({ ...state, health }, (_logId, logState) => {
          const appendAvailability = requireAuthoritativeStorageOperation(health, 'append');

          if (appendAvailability.ok) {
            return logState;
          }

          return {
            ...logState,
            buffered: [],
            currentWriter: undefined,
          };
        }),
        health,
      };
    },

    injectTailBytes(logId: string, tailBytes: Uint8Array): void {
      state = updateLogState(state, logId, (logState) => ({
        ...logState,
        quarantinedTailBytes: cloneBytes(tailBytes),
      }));
    },

    markInteriorCorrupt(logId: string): void {
      state = updateLogState(state, logId, (logState) => ({
        ...logState,
        buffered: [],
        currentWriter: undefined,
        interiorCorrupt: true,
      }));
    },
  };
};
