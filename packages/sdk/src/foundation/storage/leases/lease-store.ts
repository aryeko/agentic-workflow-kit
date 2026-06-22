import type { StorageError } from '../errors/index.js';
import { requireAuthoritativeStorageOperation, type StorageHealth } from '../health/index.js';

import type { LeaseCapability, LeaseSnapshot, LeaseStore, LeaseStoreDependencies } from './lease-store-types.js';

type LeaseRecord = {
  readonly name: string;
  readonly epoch: number;
  readonly holder: string;
  readonly tokenDigest: string;
  readonly expiresAt: Date;
};

const cloneDate = (value: Date): Date => new globalThis.Date(value.getTime());

const isStorageError = (value: unknown): value is StorageError =>
  typeof value === 'object' && value !== null && 'code' in value && 'health' in value && 'message' in value;

const isExpired = (record: LeaseRecord, now: Date): boolean => record.expiresAt.getTime() <= now.getTime();

const toLeaseCapability = (record: LeaseRecord, token: string): LeaseCapability => ({
  name: record.name,
  epoch: record.epoch,
  token,
  expiresAt: cloneDate(record.expiresAt),
});

const toLeaseSnapshot = (record: LeaseRecord): LeaseSnapshot => ({
  name: record.name,
  epoch: record.epoch,
  holder: record.holder,
  tokenDigest: record.tokenDigest,
  expiresAt: cloneDate(record.expiresAt),
});

const staleWriterError = (
  operation: 'acquire' | 'renew' | 'release',
  health: StorageHealth,
  message: string,
): StorageError => ({
  code: 'stale-writer-fenced',
  health,
  message:
    operation === 'acquire' ? message : `Lease ${operation} was fenced because the supplied epoch or token is stale.`,
});

export const createLeaseStore = ({
  now,
  createToken,
  digestToken,
  health = 'ok',
}: LeaseStoreDependencies): LeaseStore => {
  const records = new Map<string, LeaseRecord>();
  const lastEpochByName = new Map<string, number>();

  const requireLeaseMutations = (): true | StorageError => {
    const result = requireAuthoritativeStorageOperation(health, 'lease');
    return result.ok ? true : result.error;
  };

  const readCurrentRecord = (name: string): LeaseRecord | undefined => {
    const record = records.get(name);

    if (record === undefined) {
      return undefined;
    }

    return isExpired(record, now()) ? undefined : record;
  };

  return {
    acquire(name, holder, ttlMs) {
      const availability = requireLeaseMutations();

      if (isStorageError(availability)) {
        return availability;
      }

      const currentNow = now();
      const existing = records.get(name);

      if (existing !== undefined && !isExpired(existing, currentNow)) {
        return staleWriterError('acquire', health, 'Lease acquire was fenced because a live lease already exists.');
      }

      const token = createToken();
      const lastEpoch = lastEpochByName.get(name) ?? 0;
      const nextRecord: LeaseRecord = {
        name,
        epoch: Math.max(lastEpoch, existing?.epoch ?? 0) + 1,
        holder,
        tokenDigest: digestToken(token),
        expiresAt: new globalThis.Date(currentNow.getTime() + ttlMs),
      };
      records.set(name, nextRecord);
      lastEpochByName.set(name, nextRecord.epoch);

      return toLeaseCapability(nextRecord, token);
    },

    renew(name, epoch, token, ttlMs) {
      const availability = requireLeaseMutations();

      if (isStorageError(availability)) {
        return availability;
      }

      const currentNow = now();
      const existing = records.get(name);

      if (
        existing === undefined ||
        isExpired(existing, currentNow) ||
        existing.epoch !== epoch ||
        existing.tokenDigest !== digestToken(token)
      ) {
        return staleWriterError('renew', health, '');
      }

      const renewed: LeaseRecord = {
        ...existing,
        expiresAt: new globalThis.Date(currentNow.getTime() + ttlMs),
      };
      records.set(name, renewed);
      lastEpochByName.set(name, renewed.epoch);

      return toLeaseCapability(renewed, token);
    },

    release(name, epoch, token) {
      const availability = requireLeaseMutations();

      if (isStorageError(availability)) {
        return availability;
      }

      const existing = records.get(name);

      if (
        existing === undefined ||
        isExpired(existing, now()) ||
        existing.epoch !== epoch ||
        existing.tokenDigest !== digestToken(token)
      ) {
        return staleWriterError('release', health, '');
      }

      records.delete(name);
      lastEpochByName.set(name, existing.epoch);
      return undefined;
    },

    read(name) {
      const record = readCurrentRecord(name);

      if (record === undefined) {
        return { health };
      }

      return {
        snapshot: toLeaseSnapshot(record),
        health,
      };
    },

    fence(name, epoch, token) {
      const record = readCurrentRecord(name);

      if (record === undefined) {
        return false;
      }

      return record.epoch === epoch && record.tokenDigest === digestToken(token);
    },
  };
};
