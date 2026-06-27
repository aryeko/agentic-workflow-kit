import type * as sdk from 'sdk';
import {
  acquireStoryLaunchLease,
  buildStoryLaunchKey,
  recordDuplicateLaunchBlocked,
  requestStaleLaunchClearance,
} from 'sdk';
import { describe, expect, it } from 'vitest';

import {
  acquiredAtFixture,
  createLeaseStoreHarness,
  createWriterHarness,
  makeLeaseCapability,
  makeRecoverySnapshot,
  requestedAtFixture,
  runIdFixture,
  sourceEventIdsFixture,
  storyLaunchKeyFixture,
  storyLaunchPartsFixture,
} from './shared.js';

describe('core-06-s3 public sdk lease imports', () => {
  it('imports the story launch lease helpers from the sdk entrypoint', () => {
    const keyParts: sdk.StoryLaunchKeyParts = storyLaunchPartsFixture;
    const writerHarness = createWriterHarness();
    const storeHarness = createLeaseStoreHarness({
      acquireResult: makeLeaseCapability(6),
    });
    const acquireInput: sdk.AcquireStoryLaunchLeaseInput = {
      ...keyParts,
      runId: runIdFixture,
      holder: 'holder-01',
      ttlMs: 30_000,
      acquiredAt: acquiredAtFixture,
      sourceEventIds: sourceEventIdsFixture,
      writer: writerHarness.writer,
      leaseStore: storeHarness.leaseStore,
    };
    const duplicateInput: sdk.RecordDuplicateLaunchBlockedInput = {
      runId: runIdFixture,
      storyLaunchKey: storyLaunchKeyFixture,
      incumbentLeaseEpoch: 5,
      blockedAt: acquiredAtFixture,
      sourceEventIds: sourceEventIdsFixture,
      writer: writerHarness.writer,
    };
    const staleInput: sdk.RequestStaleLaunchClearanceInput = {
      snapshot: makeRecoverySnapshot(),
      holder: 'holder-02',
      ttlMs: 30_000,
      requestedAt: requestedAtFixture,
      writer: writerHarness.writer,
      leaseStore: storeHarness.leaseStore,
    };

    expect(buildStoryLaunchKey(keyParts)).toBe(storyLaunchKeyFixture);
    expect(typeof acquireStoryLaunchLease).toBe('function');
    expect(typeof recordDuplicateLaunchBlocked).toBe('function');
    expect(typeof requestStaleLaunchClearance).toBe('function');
    expect(acquireInput.runId).toBe(runIdFixture);
    expect(duplicateInput.incumbentLeaseEpoch).toBe(5);
    expect(staleInput.snapshot.runId).toBe(runIdFixture);
  });
});
