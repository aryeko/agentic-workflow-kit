import { describe, expect, it } from 'vitest';

import { requestStaleLaunchClearance } from '../../../../src/core/recovery/leases/index.js';

import {
  createLeaseStoreHarness,
  createWriterHarness,
  evidenceRefFixture,
  makeAppendFailure,
  makeLeaseCapability,
  makeRecoverySnapshot,
  makeStorageError,
  requestedAtFixture,
  storyLaunchKeyFixture,
} from './shared.js';

describe('stale-clearance-request-proof-matrix', () => {
  it('requires expired proof, acquires the next epoch, and appends StaleLaunchClearanceRequested only', () => {
    const writerHarness = createWriterHarness();
    const leaseCapability = makeLeaseCapability(6);
    const storeHarness = createLeaseStoreHarness({
      acquireResult: leaseCapability,
    });

    const result = requestStaleLaunchClearance({
      snapshot: makeRecoverySnapshot(),
      holder: 'holder-02',
      ttlMs: 30_000,
      requestedAt: requestedAtFixture,
      writer: writerHarness.writer,
      leaseStore: storeHarness.leaseStore,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.value.payload).toEqual({
      schema: 'kit-vnext.stale-launch-clearance-requested.v1',
      runId: 'run-recovery-lease-01',
      storyLaunchKey: storyLaunchKeyFixture,
      expiredLeaseEpoch: 5,
      nextLeaseEpoch: 6,
      requestedAt: requestedAtFixture,
      evidenceRefs: [evidenceRefFixture],
    });
    expect(writerHarness.appendCalls).toEqual([
      [
        expect.objectContaining({
          domain: 'core-06',
          type: 'StaleLaunchClearanceRequested',
          payload: expect.objectContaining({
            nextLeaseEpoch: 6,
          }),
        }),
      ],
    ]);
    expect(JSON.stringify(writerHarness.appendCalls)).not.toContain('StoryLaunchLeaseCleared');
  });
});

describe('lease-clearance-fail-closed-matrix', () => {
  it.each([
    {
      label: 'degraded lease health',
      snapshot: makeRecoverySnapshot({
        leases: { ...makeRecoverySnapshot().leases, leaseHealth: 'network-fs-degraded' },
      }),
      failureState: 'lease-unavailable',
    },
    {
      label: 'invalid observedAt timestamp',
      snapshot: makeRecoverySnapshot({
        observedAt: 'not-a-timestamp',
      }),
      failureState: 'lease-unavailable',
    },
    {
      label: 'missing expired story launch snapshot',
      snapshot: makeRecoverySnapshot({
        leases: { ...makeRecoverySnapshot().leases, storyLaunch: undefined },
      }),
      failureState: 'lease-unavailable',
    },
    {
      label: 'live story launch lease',
      snapshot: makeRecoverySnapshot({
        leases: {
          ...makeRecoverySnapshot().leases,
          storyLaunch: {
            ...makeRecoverySnapshot().leases.storyLaunch!,
            expiresAt: new Date('2026-06-27T12:30:00.000Z'),
          },
        },
      }),
      failureState: 'launch-duplicate-active',
    },
    {
      label: 'active writer still present',
      snapshot: makeRecoverySnapshot({
        leases: {
          ...makeRecoverySnapshot().leases,
          runWriter: {
            name: 'run-writer:run-recovery-lease-01',
            epoch: 8,
            holder: 'run-recovery-lease-01',
            tokenDigest: 'sha256:writer-token',
            expiresAt: new Date('2026-06-27T12:30:00.000Z'),
          },
        },
      }),
      failureState: 'launch-duplicate-active',
    },
    {
      label: 'missing ownership proof',
      snapshot: makeRecoverySnapshot({
        ownership: undefined,
      }),
      failureState: 'provider-evidence-gap',
    },
    {
      label: 'owned session still present',
      snapshot: makeRecoverySnapshot({
        ownership: {
          ownerState: 'owned',
          sessionId: 'session-01',
        },
      }),
      failureState: 'launch-duplicate-active',
    },
    {
      label: 'ambiguous ownership proof',
      snapshot: makeRecoverySnapshot({
        ownership: {
          ownerState: 'ambiguous',
        },
      }),
      failureState: 'provider-evidence-gap',
    },
    {
      label: 'missing process proof',
      snapshot: makeRecoverySnapshot({
        process: undefined,
      }),
      failureState: 'provider-evidence-gap',
    },
    {
      label: 'missing process evidence refs',
      snapshot: makeRecoverySnapshot({
        process: {
          state: 'empty',
          evidenceRefs: [],
        },
      }),
      failureState: 'provider-evidence-gap',
    },
    {
      label: 'active process tree still present',
      snapshot: makeRecoverySnapshot({
        process: {
          state: 'active',
          evidenceRefs: [evidenceRefFixture],
        },
      }),
      failureState: 'launch-duplicate-active',
    },
    {
      label: 'ambiguous process proof',
      snapshot: makeRecoverySnapshot({
        process: {
          state: 'ambiguous',
          evidenceRefs: [evidenceRefFixture],
        },
      }),
      failureState: 'provider-evidence-gap',
    },
    {
      label: 'missing approval proof',
      snapshot: makeRecoverySnapshot({
        approval: undefined,
      }),
      failureState: 'provider-evidence-gap',
    },
    {
      label: 'missing approval evidence refs',
      snapshot: makeRecoverySnapshot({
        approval: {
          state: 'none',
          evidenceRefs: [],
        },
      }),
      failureState: 'provider-evidence-gap',
    },
    {
      label: 'pending approval still present',
      snapshot: makeRecoverySnapshot({
        approval: {
          state: 'pending',
          evidenceRefs: [evidenceRefFixture],
        },
      }),
      failureState: 'launch-duplicate-active',
    },
    {
      label: 'unknown approval proof',
      snapshot: makeRecoverySnapshot({
        approval: {
          state: 'unknown',
          evidenceRefs: [evidenceRefFixture],
        },
      }),
      failureState: 'provider-evidence-gap',
    },
    {
      label: 'missing global evidence refs',
      snapshot: makeRecoverySnapshot({
        evidenceRefs: [],
      }),
      failureState: 'provider-evidence-gap',
    },
    {
      label: 'missing work source proof',
      snapshot: makeRecoverySnapshot({
        workSource: undefined,
      }),
      failureState: 'provider-evidence-gap',
    },
    {
      label: 'missing work source evidence refs',
      snapshot: makeRecoverySnapshot({
        workSource: {
          claimState: 'released',
          evidenceRefs: [],
        },
      }),
      failureState: 'provider-evidence-gap',
    },
    {
      label: 'claimed work source',
      snapshot: makeRecoverySnapshot({
        workSource: {
          claimState: 'claimed',
          evidenceRefs: [evidenceRefFixture],
        },
      }),
      failureState: 'launch-duplicate-active',
    },
    {
      label: 'ambiguous work source proof',
      snapshot: makeRecoverySnapshot({
        workSource: {
          claimState: 'ambiguous',
          evidenceRefs: [evidenceRefFixture],
        },
      }),
      failureState: 'provider-evidence-gap',
    },
    {
      label: 'manual edits detected',
      snapshot: makeRecoverySnapshot({
        manualEditRefs: [evidenceRefFixture],
      }),
      failureState: 'manual-edits-forbidden',
    },
  ])('fails closed for $label', ({ snapshot, failureState }) => {
    const writerHarness = createWriterHarness();
    const storeHarness = createLeaseStoreHarness({
      acquireResult: makeLeaseCapability(6),
    });

    const result = requestStaleLaunchClearance({
      snapshot,
      holder: 'holder-02',
      ttlMs: 30_000,
      requestedAt: requestedAtFixture,
      writer: writerHarness.writer,
      leaseStore: storeHarness.leaseStore,
    });

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }

    expect(result.error).toEqual(expect.objectContaining({ failureState }));
    expect(writerHarness.appendCalls).toHaveLength(0);
  });

  it('maps a fenced next-epoch acquire to launch-duplicate-active', () => {
    const writerHarness = createWriterHarness();
    const storeHarness = createLeaseStoreHarness({
      acquireResult: makeStorageError('stale-writer-fenced'),
    });

    const result = requestStaleLaunchClearance({
      snapshot: makeRecoverySnapshot(),
      holder: 'holder-02',
      ttlMs: 30_000,
      requestedAt: requestedAtFixture,
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
  });

  it('maps an unavailable next-epoch acquire to lease-unavailable', () => {
    const writerHarness = createWriterHarness();
    const storeHarness = createLeaseStoreHarness({
      acquireResult: makeStorageError('lease-unavailable', 'read-only'),
    });

    const result = requestStaleLaunchClearance({
      snapshot: makeRecoverySnapshot(),
      holder: 'holder-02',
      ttlMs: 30_000,
      requestedAt: requestedAtFixture,
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

  it('releases the next epoch when the clearance request cannot be appended', () => {
    const writerHarness = createWriterHarness({ ok: false, error: makeAppendFailure() });
    const leaseCapability = makeLeaseCapability(7);
    const storeHarness = createLeaseStoreHarness({
      acquireResult: leaseCapability,
    });

    const result = requestStaleLaunchClearance({
      snapshot: makeRecoverySnapshot(),
      holder: 'holder-02',
      ttlMs: 30_000,
      requestedAt: requestedAtFixture,
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
        epoch: 7,
        token: leaseCapability.token,
      },
    ]);
  });
});
