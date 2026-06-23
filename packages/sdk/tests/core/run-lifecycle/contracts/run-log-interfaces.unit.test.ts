import { describe, expect, it } from 'vitest';

import type { RunEventLog, RunWriter } from '../../../../src/index.js';

import {
  createRunInputFixture,
  leaseCapabilityFixture,
  runAppendFailureFixture,
  runAppendReceiptFixture,
  runProjectionsFixture,
  runReplayFailureFixture,
  runReplayFixture,
  waitRunEventsRequestFixture,
  waitRunEventsResultFixture,
} from './fixtures.js';

describe('core-01-s1 run log interfaces', () => {
  it('constructs conforming RunWriter and RunEventLog fixtures', () => {
    const writer: RunWriter = {
      append: () => ({ ok: true, value: runAppendReceiptFixture }),
      renew: () => ({ ok: true, value: writer }),
    };

    const log: RunEventLog = {
      createRun: () => ({ ok: true, value: writer }),
      openWriter: () => ({ ok: true, value: writer }),
      replay: () => ({ ok: true, value: runReplayFixture }),
      waitRunEvents: () => ({ ok: true, value: waitRunEventsResultFixture }),
      project: () => ({ ok: true, value: runProjectionsFixture }),
    };

    expect(log.createRun(createRunInputFixture)).toEqual({ ok: true, value: writer });
    expect(log.openWriter(createRunInputFixture.runId, leaseCapabilityFixture)).toEqual({
      ok: true,
      value: writer,
    });
    expect(log.replay(createRunInputFixture.runId)).toEqual({ ok: true, value: runReplayFixture });
    expect(log.waitRunEvents(waitRunEventsRequestFixture)).toEqual({
      ok: true,
      value: waitRunEventsResultFixture,
    });
    expect(log.project(createRunInputFixture.runId)).toEqual({
      ok: true,
      value: runProjectionsFixture,
    });

    const appendFailure = { ok: false, error: runAppendFailureFixture } as const;
    const replayFailure = { ok: false, error: runReplayFailureFixture } as const;

    expect(appendFailure.error.code).toBe('stale-writer-fenced');
    expect(replayFailure.error.code).toBe('interior-corrupt');
    expect(writer.append([])).toEqual({ ok: true, value: runAppendReceiptFixture });
  });
});
