import type { StorageError } from '../errors/index.js';
import type { StorageHealth } from '../health/index.js';

export const DURABILITY_CLASSES = Object.freeze(['buffered', 'durable', 'barrier'] as const);

export type DurabilityClass = (typeof DURABILITY_CLASSES)[number];

export type EventLogLeaseBinding = {
  readonly name: string;
  readonly epoch: number;
  readonly token: string;
};

export type ByteRange = {
  readonly start: number;
  readonly end: number;
};

export type LogHandle = {
  readonly logId: string;
  readonly leaseName: string;
  readonly epoch: number;
  readonly token: string;
};

export type AppendBatch = {
  readonly expectedSequence: number;
  readonly durability: DurabilityClass;
  readonly payloads: readonly Uint8Array[];
};

export type AppendReceipt = {
  readonly firstSequence: number;
  readonly lastSequence: number;
  readonly writerEpoch: number;
  readonly leaseName: string;
  readonly durability: DurabilityClass;
  readonly byteRange: ByteRange;
  readonly payloadDigest: string;
  readonly frameDigest: string;
};

export type NonDurableAck = {
  readonly acknowledged: true;
  readonly durability: 'buffered';
  readonly expectedSequence: number;
};

export type StoredRecord = {
  readonly sequence: number;
  readonly writerEpoch: number;
  readonly leaseName: string;
  readonly payloadLength: number;
  readonly payloadDigest: string;
  readonly frameDigest: string;
  readonly byteRange: ByteRange;
  readonly payload: Uint8Array;
};

export type ReplayResult = {
  readonly records: StoredRecord[];
  readonly health: StorageHealth;
};

export interface EventLogStore {
  openForAppend(logId: string, lease: EventLogLeaseBinding): LogHandle | StorageError;
  append(handle: LogHandle, batch: AppendBatch): AppendReceipt | NonDurableAck | StorageError;
  replay(logId: string): ReplayResult;
}
