import { describe, expect, it } from 'vitest';

import { createInMemoryEventLogStore } from '../../../../src/foundation/storage/event-log/index.js';

const textEncoder = new TextEncoder();

const encodeBytes = (value: string): Uint8Array => textEncoder.encode(value);

const digestBytes = (bytes: Uint8Array): string =>
  `digest:${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;

describe('fnd-02-s2 event-log replay state isolation', () => {
  it('returns cloned replay payloads so callers cannot mutate internal committed history', () => {
    const store = createInMemoryEventLogStore({ digestBytes });
    const handle = store.openForAppend('run-log', {
      name: 'run-writer:alpha',
      epoch: 1,
      token: 'lease-token-1',
    });

    store.append(handle, {
      expectedSequence: 1,
      durability: 'durable',
      payloads: [encodeBytes('alpha')],
    });

    const firstReplay = store.replay('run-log');
    firstReplay.records[0]?.payload.set([0x7a]);

    const secondReplay = store.replay('run-log');

    expect(Array.from(secondReplay.records[0]?.payload ?? [])).toEqual(Array.from(encodeBytes('alpha')));
  });
});
