import { describe, expect, it } from 'vitest';

import {
  DURABILITY_CLASSES,
  createInMemoryEventLogStore,
  type EventLogLeaseBinding,
} from '../../../../src/foundation/storage/event-log/index.js';

const textEncoder = new TextEncoder();

const encodeBytes = (value: string): Uint8Array => textEncoder.encode(value);

const digestBytes = (bytes: Uint8Array): string =>
  `digest:${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;

const eventLogLeaseBinding = (overrides: Partial<EventLogLeaseBinding> = {}): EventLogLeaseBinding => ({
  name: 'run-writer:alpha',
  epoch: 7,
  token: 'lease-token-7',
  ...overrides,
});

describe('fnd-02-s2 event-log contract surface', () => {
  it('defines the durability catalog as buffered, durable, and barrier', () => {
    expect(DURABILITY_CLASSES).toEqual(['buffered', 'durable', 'barrier']);
    expect(Object.isFrozen(DURABILITY_CLASSES)).toBe(true);
  });

  it('mints log handles bound to the supplied lease capability', () => {
    const store = createInMemoryEventLogStore({ digestBytes });

    const handle = store.openForAppend('run-log', eventLogLeaseBinding());

    expect(handle).toEqual({
      logId: 'run-log',
      leaseName: 'run-writer:alpha',
      epoch: 7,
      token: 'lease-token-7',
    });
  });

  it('rejects stale or missing lease credentials before appending bytes', () => {
    const store = createInMemoryEventLogStore({ digestBytes });
    const staleHandle = store.openForAppend('run-log', eventLogLeaseBinding({ epoch: 7, token: 'stale-token' }));

    store.openForAppend('run-log', eventLogLeaseBinding({ epoch: 8, token: 'fresh-token' }));

    expect(
      store.append(staleHandle, {
        expectedSequence: 1,
        durability: 'durable',
        payloads: [encodeBytes('stale')],
      }),
    ).toEqual({
      code: 'stale-writer-fenced',
      health: 'ok',
      message: 'Append handle no longer matches the current lease binding for log run-log.',
    });

    expect(
      store.append(
        {
          logId: 'run-log',
          leaseName: 'run-writer:alpha',
          epoch: 8,
          token: '',
        },
        {
          expectedSequence: 1,
          durability: 'durable',
          payloads: [encodeBytes('missing-token')],
        },
      ),
    ).toEqual({
      code: 'stale-writer-fenced',
      health: 'ok',
      message: 'Append handle must include a lease name and token before bytes can be appended.',
    });

    expect(store.replay('run-log')).toEqual({
      records: [],
      health: 'ok',
    });
  });

  it('returns a non-durable acknowledgement for buffered appends and does not replay them as committed', () => {
    const store = createInMemoryEventLogStore({ digestBytes });
    const handle = store.openForAppend('run-log', eventLogLeaseBinding());

    const result = store.append(handle, {
      expectedSequence: 1,
      durability: 'buffered',
      payloads: [encodeBytes('buffered-payload')],
    });

    expect(result).toEqual({
      acknowledged: true,
      durability: 'buffered',
      expectedSequence: 1,
    });
    expect('firstSequence' in result).toBe(false);
    expect(store.replay('run-log')).toEqual({
      records: [],
      health: 'ok',
    });
  });

  it('returns durable append receipts with sequence, byte-range, and digest evidence', () => {
    const store = createInMemoryEventLogStore({
      digestBytes,
      recordFrameOverheadBytes: 4,
      commitTrailerBytes: 3,
    });
    const handle = store.openForAppend('run-log', eventLogLeaseBinding());

    const durableReceipt = store.append(handle, {
      expectedSequence: 1,
      durability: 'durable',
      payloads: [encodeBytes('alpha'), encodeBytes('beta')],
    });

    expect(durableReceipt).toMatchObject({
      firstSequence: 1,
      lastSequence: 2,
      writerEpoch: 7,
      leaseName: 'run-writer:alpha',
      durability: 'durable',
      byteRange: { start: 0, end: 20 },
    });
    expect(durableReceipt).toMatchObject({
      payloadDigest: expect.any(String),
      frameDigest: expect.any(String),
    });

    expect(store.replay('run-log')).toEqual({
      health: 'ok',
      records: [
        {
          sequence: 1,
          writerEpoch: 7,
          leaseName: 'run-writer:alpha',
          payloadLength: 5,
          payloadDigest: expect.any(String),
          frameDigest: expect.any(String),
          byteRange: { start: 0, end: 9 },
          payload: encodeBytes('alpha'),
        },
        {
          sequence: 2,
          writerEpoch: 7,
          leaseName: 'run-writer:alpha',
          payloadLength: 4,
          payloadDigest: expect.any(String),
          frameDigest: expect.any(String),
          byteRange: { start: 9, end: 17 },
          payload: encodeBytes('beta'),
        },
      ],
    });
  });

  it('flushes prior buffered bytes before returning a barrier receipt', () => {
    const store = createInMemoryEventLogStore({
      digestBytes,
      recordFrameOverheadBytes: 2,
      commitTrailerBytes: 2,
    });
    const handle = store.openForAppend('run-log', eventLogLeaseBinding());

    expect(
      store.append(handle, {
        expectedSequence: 1,
        durability: 'buffered',
        payloads: [encodeBytes('prep')],
      }),
    ).toEqual({
      acknowledged: true,
      durability: 'buffered',
      expectedSequence: 1,
    });

    const barrierReceipt = store.append(handle, {
      expectedSequence: 2,
      durability: 'barrier',
      payloads: [encodeBytes('gate')],
    });

    expect(barrierReceipt).toMatchObject({
      firstSequence: 1,
      lastSequence: 2,
      durability: 'barrier',
      byteRange: { start: 0, end: 14 },
    });
    expect(store.replay('run-log')).toEqual({
      health: 'ok',
      records: [
        expect.objectContaining({ sequence: 1, payload: encodeBytes('prep') }),
        expect.objectContaining({ sequence: 2, payload: encodeBytes('gate') }),
      ],
    });
  });

  it('reports repaired tails while replaying committed records in sequence order', () => {
    const store = createInMemoryEventLogStore({ digestBytes });
    const handle = store.openForAppend('run-log', eventLogLeaseBinding());

    store.append(handle, {
      expectedSequence: 1,
      durability: 'durable',
      payloads: [encodeBytes('alpha'), encodeBytes('beta')],
    });
    store.injectTailBytes('run-log', encodeBytes('partial-tail'));

    expect(store.replay('run-log')).toEqual({
      health: 'log-tail-repaired',
      records: [
        expect.objectContaining({ sequence: 1, payload: encodeBytes('alpha') }),
        expect.objectContaining({ sequence: 2, payload: encodeBytes('beta') }),
      ],
    });
  });

  it('marks interior corruption as incoherent and rejects further appends', () => {
    const store = createInMemoryEventLogStore({ digestBytes });
    const handle = store.openForAppend('run-log', eventLogLeaseBinding());

    store.append(handle, {
      expectedSequence: 1,
      durability: 'durable',
      payloads: [encodeBytes('alpha')],
    });
    store.markInteriorCorrupt('run-log');

    expect(store.replay('run-log')).toEqual({
      health: 'log-interior-corrupt',
      records: [expect.objectContaining({ sequence: 1, payload: encodeBytes('alpha') })],
    });
    expect(
      store.append(handle, {
        expectedSequence: 2,
        durability: 'durable',
        payloads: [encodeBytes('beta')],
      }),
    ).toEqual({
      code: 'log-interior-corrupt',
      health: 'log-interior-corrupt',
      message: 'Committed history is incoherent for log run-log; append is read-only.',
    });
  });

  it('blocks authoritative appends under degraded storage and invalidates open handles', () => {
    const store = createInMemoryEventLogStore({ digestBytes });
    const handle = store.openForAppend('run-log', eventLogLeaseBinding());

    store.setStorageHealth('network-fs-degraded');

    expect(store.openForAppend('run-log', eventLogLeaseBinding({ epoch: 9, token: 'new-token' }))).toEqual({
      code: 'network-fs-degraded',
      health: 'network-fs-degraded',
      message: 'Authoritative append is unavailable while storage health is network-fs-degraded.',
    });
    expect(
      store.append(handle, {
        expectedSequence: 1,
        durability: 'durable',
        payloads: [encodeBytes('blocked')],
      }),
    ).toEqual({
      code: 'network-fs-degraded',
      health: 'network-fs-degraded',
      message: 'Authoritative append is unavailable while storage health is network-fs-degraded.',
    });
    expect(store.replay('run-log')).toEqual({
      health: 'network-fs-degraded',
      records: [],
    });
  });
});
