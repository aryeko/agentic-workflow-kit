import type { LeaseSnapshot } from '../../../foundation/storage/index.js';

export type LeaseExpiryStatus = 'expired' | 'live' | 'missing' | 'invalid-observed-at';

export const classifyLeaseExpiryAtObservedAt = (
  lease: LeaseSnapshot | undefined,
  observedAt: string,
): LeaseExpiryStatus => {
  const observedAtMs = globalThis.Date.parse(observedAt);
  if (Number.isNaN(observedAtMs)) {
    return 'invalid-observed-at';
  }

  if (lease === undefined) {
    return 'missing';
  }

  return lease.expiresAt.getTime() <= observedAtMs ? 'expired' : 'live';
};
