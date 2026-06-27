import { describe, expect, it } from 'vitest';

import { recordDuplicateLaunchBlocked } from '../../../../src/core/recovery/leases/index.js';

import {
  blockedAtFixture,
  createWriterHarness,
  makeAppendFailure,
  runIdFixture,
  sourceEventIdsFixture,
  storyLaunchKeyFixture,
} from './shared.js';

describe('duplicate-live-with-writer', () => {
  it('appends DuplicateLaunchBlocked with the incumbent lease epoch when a writer is available', () => {
    const writerHarness = createWriterHarness();

    const result = recordDuplicateLaunchBlocked({
      runId: runIdFixture,
      storyLaunchKey: storyLaunchKeyFixture,
      incumbentLeaseEpoch: 5,
      blockedAt: blockedAtFixture,
      sourceEventIds: sourceEventIdsFixture,
      writer: writerHarness.writer,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(writerHarness.appendCalls).toEqual([
      [
        expect.objectContaining({
          domain: 'core-06',
          type: 'DuplicateLaunchBlocked',
          durability: 'barrier',
          occurredAt: blockedAtFixture,
          causationId: sourceEventIdsFixture[0],
          payload: {
            schema: 'kit-vnext.duplicate-launch-blocked.v1',
            runId: runIdFixture,
            storyLaunchKey: storyLaunchKeyFixture,
            incumbentLeaseEpoch: 5,
            blockedAt: blockedAtFixture,
            sourceEventIds: sourceEventIdsFixture,
          },
        }),
      ],
    ]);
  });
});

describe('duplicate-live-no-writer', () => {
  it('returns a refusal before launch side effects when no writer is available', () => {
    const result = recordDuplicateLaunchBlocked({
      runId: runIdFixture,
      storyLaunchKey: storyLaunchKeyFixture,
      incumbentLeaseEpoch: 5,
      blockedAt: blockedAtFixture,
      sourceEventIds: sourceEventIdsFixture,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        reason: 'duplicate-launch-active',
        failureState: 'launch-duplicate-active',
        incumbentLeaseEpoch: 5,
      },
    });
  });

  it('surfaces append failures when the duplicate block cannot be recorded', () => {
    const writerHarness = createWriterHarness({ ok: false, error: makeAppendFailure() });

    const result = recordDuplicateLaunchBlocked({
      runId: runIdFixture,
      storyLaunchKey: storyLaunchKeyFixture,
      incumbentLeaseEpoch: 5,
      blockedAt: blockedAtFixture,
      sourceEventIds: sourceEventIdsFixture,
      writer: writerHarness.writer,
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        reason: 'event-log-unwritable',
      }),
    });
  });
});
