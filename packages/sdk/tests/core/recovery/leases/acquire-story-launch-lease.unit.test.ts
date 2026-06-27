import { describe, expect, it } from 'vitest';

import { acquireStoryLaunchLease } from '../../../../src/core/recovery/leases/index.js';

import {
  acquiredAtFixture,
  createLeaseStoreHarness,
  createWriterHarness,
  makeAppendFailure,
  makeLeaseCapability,
  makeStorageError,
  runIdFixture,
  sourceEventIdsFixture,
  storyLaunchKeyFixture,
  storyLaunchPartsFixture,
} from './shared.js';

describe('launch-lease-acquired-order-and-fields', () => {
  it('appends StoryLaunchLeaseAcquired after lease acquisition with the required fields', () => {
    const writerHarness = createWriterHarness();
    const storeHarness = createLeaseStoreHarness({
      acquireResult: makeLeaseCapability(6),
    });

    const result = acquireStoryLaunchLease({
      ...storyLaunchPartsFixture,
      runId: runIdFixture,
      holder: 'holder-01',
      ttlMs: 30_000,
      acquiredAt: acquiredAtFixture,
      sourceEventIds: sourceEventIdsFixture,
      writer: writerHarness.writer,
      leaseStore: storeHarness.leaseStore,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.leaseCapability.epoch).toBe(6);
    expect(storeHarness.acquireCalls).toEqual([{ name: storyLaunchKeyFixture, holder: 'holder-01', ttlMs: 30_000 }]);
    expect(writerHarness.appendCalls).toHaveLength(1);
    expect(writerHarness.appendCalls[0]).toEqual([
      expect.objectContaining({
        domain: 'core-06',
        type: 'StoryLaunchLeaseAcquired',
        durability: 'barrier',
        occurredAt: acquiredAtFixture,
        causationId: sourceEventIdsFixture[0],
        payload: {
          schema: 'kit-vnext.story-launch-lease-acquired.v1',
          runId: runIdFixture,
          storyLaunchKey: storyLaunchKeyFixture,
          leaseEpoch: 6,
          acquiredAt: acquiredAtFixture,
          sourceEventIds: sourceEventIdsFixture,
        },
      }),
    ]);
  });
});

describe('acquireStoryLaunchLease fail-closed behavior', () => {
  it('rejects empty source event ids before any side effects', () => {
    const writerHarness = createWriterHarness();
    const storeHarness = createLeaseStoreHarness();

    expect(() =>
      acquireStoryLaunchLease({
        ...storyLaunchPartsFixture,
        runId: runIdFixture,
        holder: 'holder-01',
        ttlMs: 30_000,
        acquiredAt: acquiredAtFixture,
        sourceEventIds: [],
        writer: writerHarness.writer,
        leaseStore: storeHarness.leaseStore,
      }),
    ).toThrow(/at least one source event id/);

    expect(storeHarness.acquireCalls).toHaveLength(0);
  });

  it('maps a live duplicate acquire fence to launch-duplicate-active', () => {
    const writerHarness = createWriterHarness();
    const storeHarness = createLeaseStoreHarness({
      acquireResult: makeStorageError('stale-writer-fenced'),
    });

    const result = acquireStoryLaunchLease({
      ...storyLaunchPartsFixture,
      runId: runIdFixture,
      holder: 'holder-01',
      ttlMs: 30_000,
      acquiredAt: acquiredAtFixture,
      sourceEventIds: sourceEventIdsFixture,
      writer: writerHarness.writer,
      leaseStore: storeHarness.leaseStore,
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        reason: 'lease-store-unavailable',
        failureState: 'launch-duplicate-active',
      }),
    });
    expect(writerHarness.appendCalls).toHaveLength(0);
  });

  it('maps non-fencing lease errors to lease-unavailable', () => {
    const writerHarness = createWriterHarness();
    const storeHarness = createLeaseStoreHarness({
      acquireResult: makeStorageError('lease-unavailable', 'read-only'),
    });

    const result = acquireStoryLaunchLease({
      ...storyLaunchPartsFixture,
      runId: runIdFixture,
      holder: 'holder-01',
      ttlMs: 30_000,
      acquiredAt: acquiredAtFixture,
      sourceEventIds: sourceEventIdsFixture,
      writer: writerHarness.writer,
      leaseStore: storeHarness.leaseStore,
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        reason: 'lease-store-unavailable',
        failureState: 'lease-unavailable',
      }),
    });
  });

  it('releases the acquired lease when the acquisition event cannot be appended', () => {
    const writerHarness = createWriterHarness({ ok: false, error: makeAppendFailure() });
    const leaseCapability = makeLeaseCapability(9);
    const storeHarness = createLeaseStoreHarness({
      acquireResult: leaseCapability,
    });

    const result = acquireStoryLaunchLease({
      ...storyLaunchPartsFixture,
      runId: runIdFixture,
      holder: 'holder-01',
      ttlMs: 30_000,
      acquiredAt: acquiredAtFixture,
      sourceEventIds: sourceEventIdsFixture,
      writer: writerHarness.writer,
      leaseStore: storeHarness.leaseStore,
    });

    expect(result).toEqual({
      ok: false,
      error: expect.objectContaining({
        reason: 'event-log-unwritable',
        leaseCapability,
      }),
    });
    expect(storeHarness.releaseCalls).toEqual([
      {
        name: storyLaunchKeyFixture,
        epoch: 9,
        token: leaseCapability.token,
      },
    ]);
  });
});
