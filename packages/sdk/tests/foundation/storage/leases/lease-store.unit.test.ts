import { describe, expect, it } from 'vitest';

import {
  createLeaseStore,
  type LeaseCapability,
  type LeaseSnapshot,
  type LeaseStore,
} from '../../../../src/foundation/storage/leases/index.js';

const at = (value: string): Date => new globalThis.Date(Date.parse(value));

const createClock = (initial: string) => {
  let nowMs = Date.parse(initial);

  return {
    now: (): Date => new globalThis.Date(nowMs),
    advanceMs: (deltaMs: number): void => {
      nowMs += deltaMs;
    },
  };
};

const expectCapability = (value: LeaseCapability | ReturnType<LeaseStore['acquire']>): LeaseCapability =>
  value as LeaseCapability;

const expectSnapshot = (value: LeaseSnapshot | undefined): LeaseSnapshot => value as LeaseSnapshot;

describe('fnd-02-s3 lease store', () => {
  it('acquires opaque lease names and advances epoch monotonically after expiry', () => {
    const clock = createClock('2026-06-22T09:00:00.000Z');
    const store = createLeaseStore({
      now: clock.now,
      createToken: (() => {
        let next = 0;
        return () => {
          next += 1;
          return `token-${next}`;
        };
      })(),
      digestToken: (token) => `digest:${token}`,
    });

    const first = expectCapability(store.acquire('story-launch::opaque/name?x=1', 'holder-a', 60_000));

    expect(first).toEqual({
      name: 'story-launch::opaque/name?x=1',
      epoch: 1,
      token: 'token-1',
      expiresAt: at('2026-06-22T09:01:00.000Z'),
    });
    expect(store.read('story-launch::opaque/name?x=1')).toEqual({
      snapshot: {
        name: 'story-launch::opaque/name?x=1',
        epoch: 1,
        holder: 'holder-a',
        tokenDigest: 'digest:token-1',
        expiresAt: at('2026-06-22T09:01:00.000Z'),
      },
      health: 'ok',
    });

    clock.advanceMs(60_000);

    const second = expectCapability(store.acquire('story-launch::opaque/name?x=1', 'holder-b', 30_000));

    expect(second).toEqual({
      name: 'story-launch::opaque/name?x=1',
      epoch: 2,
      token: 'token-2',
      expiresAt: at('2026-06-22T09:01:30.000Z'),
    });
  });

  it('renews only the current unexpired lease and returns updated capability expiry', () => {
    const clock = createClock('2026-06-22T10:00:00.000Z');
    const store = createLeaseStore({
      now: clock.now,
      createToken: () => 'renew-token',
      digestToken: (token) => `digest:${token}`,
    });
    const acquired = expectCapability(store.acquire('run-writer:abc', 'holder-a', 20_000));

    clock.advanceMs(5_000);

    expect(store.renew('run-writer:abc', acquired.epoch, acquired.token, 45_000)).toEqual({
      name: 'run-writer:abc',
      epoch: 1,
      token: 'renew-token',
      expiresAt: at('2026-06-22T10:00:50.000Z'),
    });
  });

  it('fences stale renew and stale release attempts before mutating the lease', () => {
    const clock = createClock('2026-06-22T11:00:00.000Z');
    const store = createLeaseStore({
      now: clock.now,
      createToken: () => 'lease-token',
      digestToken: (token) => `digest:${token}`,
    });
    const acquired = expectCapability(store.acquire('run-writer:xyz', 'holder-a', 30_000));

    expect(store.renew('run-writer:xyz', acquired.epoch + 1, acquired.token, 30_000)).toEqual({
      code: 'stale-writer-fenced',
      health: 'ok',
      message: 'Lease renew was fenced because the supplied epoch or token is stale.',
    });
    expect(store.release('run-writer:xyz', acquired.epoch, 'wrong-token')).toEqual({
      code: 'stale-writer-fenced',
      health: 'ok',
      message: 'Lease release was fenced because the supplied epoch or token is stale.',
    });
    expect(store.read('run-writer:xyz')).toEqual({
      snapshot: {
        name: 'run-writer:xyz',
        epoch: 1,
        holder: 'holder-a',
        tokenDigest: 'digest:lease-token',
        expiresAt: at('2026-06-22T11:00:30.000Z'),
      },
      health: 'ok',
    });
  });

  it('never exposes raw tokens in snapshots and clears released leases', () => {
    const clock = createClock('2026-06-22T12:00:00.000Z');
    const store = createLeaseStore({
      now: clock.now,
      createToken: () => 'secret-token',
      digestToken: (token) => `digest:${token}`,
    });
    const acquired = expectCapability(store.acquire('opaque lease', 'holder-a', 15_000));
    const beforeRelease = expectSnapshot(store.read('opaque lease').snapshot);

    expect(beforeRelease).toEqual({
      name: 'opaque lease',
      epoch: 1,
      holder: 'holder-a',
      tokenDigest: 'digest:secret-token',
      expiresAt: at('2026-06-22T12:00:15.000Z'),
    });
    expect(beforeRelease).not.toHaveProperty('token');

    expect(store.release('opaque lease', acquired.epoch, acquired.token)).toBeUndefined();
    expect(store.read('opaque lease')).toEqual({ health: 'ok' });
    expect(store.fence('opaque lease', acquired.epoch, acquired.token)).toBe(false);
  });

  it('keeps epochs monotonic across release and reacquire for the same lease name', () => {
    const clock = createClock('2026-06-22T12:30:00.000Z');
    const store = createLeaseStore({
      now: clock.now,
      createToken: (() => {
        let next = 0;
        return () => {
          next += 1;
          return `token-${next}`;
        };
      })(),
      digestToken: (token) => `digest:${token}`,
    });

    const first = expectCapability(store.acquire('opaque lease', 'holder-a', 15_000));

    expect(store.release('opaque lease', first.epoch, first.token)).toBeUndefined();
    expect(store.read('opaque lease')).toEqual({ health: 'ok' });

    const second = expectCapability(store.acquire('opaque lease', 'holder-b', 15_000));

    expect(second.epoch).toBe(2);
    expect(second.token).toBe('token-2');
  });

  it('renews using the supplied token while read snapshots still expose digest-only lease state', () => {
    const clock = createClock('2026-06-22T12:45:00.000Z');
    const store = createLeaseStore({
      now: clock.now,
      createToken: () => 'persisted-secret',
      digestToken: (token) => `digest:${token}`,
    });
    const acquired = expectCapability(store.acquire('digest-only', 'holder-a', 10_000));

    clock.advanceMs(2_000);

    const renewed = expectCapability(store.renew('digest-only', acquired.epoch, acquired.token, 25_000));
    const snapshot = expectSnapshot(store.read('digest-only').snapshot);

    expect(renewed).toEqual({
      name: 'digest-only',
      epoch: 1,
      token: 'persisted-secret',
      expiresAt: at('2026-06-22T12:45:27.000Z'),
    });
    expect(snapshot).toEqual({
      name: 'digest-only',
      epoch: 1,
      holder: 'holder-a',
      tokenDigest: 'digest:persisted-secret',
      expiresAt: at('2026-06-22T12:45:27.000Z'),
    });
    expect(snapshot).not.toHaveProperty('token');
  });

  it('returns true from fence only for the current unexpired epoch and matching token digest', () => {
    const clock = createClock('2026-06-22T13:00:00.000Z');
    const store = createLeaseStore({
      now: clock.now,
      createToken: () => 'fence-token',
      digestToken: (token) => `digest:${token}`,
    });
    const acquired = expectCapability(store.acquire('story-launch:fence', 'holder-a', 10_000));

    expect(store.fence('story-launch:fence', acquired.epoch, acquired.token)).toBe(true);
    expect(store.fence('story-launch:fence', acquired.epoch + 1, acquired.token)).toBe(false);
    expect(store.fence('story-launch:fence', acquired.epoch, 'other-token')).toBe(false);

    clock.advanceMs(10_001);

    expect(store.fence('story-launch:fence', acquired.epoch, acquired.token)).toBe(false);
    expect(store.read('story-launch:fence')).toEqual({ health: 'ok' });
  });

  it('fails closed for degraded lease mutations with typed no-capability failures', () => {
    const degradedHealths = ['network-fs-degraded', 'read-only', 'unusable'] as const;

    for (const health of degradedHealths) {
      const store = createLeaseStore({
        health,
        now: () => at('2026-06-22T14:00:00.000Z'),
        createToken: () => 'degraded-token',
        digestToken: (token) => `digest:${token}`,
      });

      expect(store.acquire('degraded-lease', 'holder-a', 1_000)).toEqual({
        code: health === 'network-fs-degraded' ? 'network-fs-degraded' : 'lease-unavailable',
        health,
        message: `Authoritative lease is unavailable while storage health is ${health}.`,
      });
      expect(store.renew('degraded-lease', 1, 'degraded-token', 1_000)).toEqual({
        code: health === 'network-fs-degraded' ? 'network-fs-degraded' : 'lease-unavailable',
        health,
        message: `Authoritative lease is unavailable while storage health is ${health}.`,
      });
      expect(store.release('degraded-lease', 1, 'degraded-token')).toEqual({
        code: health === 'network-fs-degraded' ? 'network-fs-degraded' : 'lease-unavailable',
        health,
        message: `Authoritative lease is unavailable while storage health is ${health}.`,
      });
      expect(store.read('degraded-lease')).toEqual({ health });
      expect(store.fence('degraded-lease', 1, 'degraded-token')).toBe(false);
    }
  });
});
