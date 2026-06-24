import { describe, expect, it } from 'vitest';

import type { RunLogHealthRecord } from '../../../../src/index.js';

import { runLogCorruptionRecordFixture, runLogUnavailableRecordFixture } from './fixtures.js';

describe('core-01-s1 health records', () => {
  it('narrows the corruption arm by kind', () => {
    const record: RunLogHealthRecord = runLogCorruptionRecordFixture;

    if (record.kind === 'event-log-unavailable') {
      throw new Error('expected corruption record');
    }

    expect(record.storageHealth).toBe('log-tail-repaired');
    expect(record.lastValidSequence).toBe(2);
  });

  it('narrows the unavailable arm by kind', () => {
    const record: RunLogHealthRecord = runLogUnavailableRecordFixture;

    if (record.kind !== 'event-log-unavailable') {
      throw new Error('expected unavailable record');
    }

    expect(record.storageHealth).toBe('read-only');
    expect(record.detail).toContain('filesystem');
  });
});
