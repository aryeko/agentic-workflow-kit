import type { StorageError } from '../errors/index.js';
import type { StorageHealth } from '../health/index.js';
import type { LeaseCapability, LeaseSnapshot, LeaseStore } from '../leases/index.js';
import type { OpenFilesystemStorageOptions } from './filesystem-types.js';
import {
  LEASES_DIRECTORY,
  QUARANTINE_DIRECTORY,
  cloneDate,
  createStorageError,
  encodePathComponent,
  isExpired,
  leaseFilePath,
  leaseGuardPath,
  parseLeaseRecord,
  serializeJson,
  writeTempThenRename,
  type FilesystemController,
  type LeaseRecord,
  type SerializedLeaseRecord,
} from './filesystem-common.js';

type GuardAuthoritativeLease = () => true | StorageError;

export type CreateFilesystemLeaseStoreOptions = {
  readonly backend: OpenFilesystemStorageOptions['backend'];
  readonly controller: FilesystemController;
  readonly currentHealth: () => StorageHealth;
  readonly guardAuthoritative: GuardAuthoritativeLease;
  readonly digestToken: (token: string) => string;
  readonly createToken: () => string;
  readonly now: () => Date;
};

export const createFilesystemLeaseStore = ({
  backend,
  controller,
  currentHealth,
  guardAuthoritative,
  digestToken,
  createToken,
  now,
}: CreateFilesystemLeaseStoreOptions): LeaseStore => {
  const readLeaseRecord = (name: string): LeaseRecord | undefined =>
    parseLeaseRecord(backend.readFile(leaseFilePath(name)));

  const toLeaseSnapshot = (record: LeaseRecord): LeaseSnapshot => ({
    name: record.name,
    epoch: record.epoch,
    holder: record.holder,
    tokenDigest: record.tokenDigest,
    expiresAt: cloneDate(record.expiresAt),
  });

  const toLeaseCapability = (record: LeaseRecord, token: string): LeaseCapability => ({
    name: record.name,
    epoch: record.epoch,
    token,
    expiresAt: cloneDate(record.expiresAt),
  });

  const persistLeaseRecord = (record: LeaseRecord): void => {
    writeTempThenRename(
      backend,
      leaseFilePath(record.name),
      serializeJson({
        name: record.name,
        epoch: record.epoch,
        holder: record.holder,
        tokenDigest: record.tokenDigest,
        expiresAt: record.expiresAt.toISOString(),
      } satisfies SerializedLeaseRecord),
    );
  };

  const withLeaseGuard = (name: string, operation: () => LeaseRecord): LeaseRecord | StorageError => {
    const guardPath = leaseGuardPath(name);
    const guardExpiresAt = new Date(now().getTime() + 60_000).toISOString();

    try {
      backend.writeExclusive(guardPath, serializeJson({ name, guardExpiresAt }));
      backend.fsyncFile(guardPath);
      backend.fsyncDirectory(LEASES_DIRECTORY);
      const record = operation();
      persistLeaseRecord(record);
      backend.remove(guardPath);
      backend.fsyncDirectory(LEASES_DIRECTORY);
      return record;
    } catch {
      controller.degrade(`${QUARANTINE_DIRECTORY}/leases/${encodePathComponent(name)}.guard.json`);
      return createStorageError(
        'lease-unavailable',
        controller.getHealth(),
        'Lease acquire could not prove the guarded update.',
      );
    }
  };

  return {
    acquire(name, holder, ttlMs) {
      const availability = guardAuthoritative();
      if (availability !== true) {
        return availability;
      }

      const currentRecord = readLeaseRecord(name);
      const currentNow = now();
      if (currentRecord !== undefined && !isExpired(currentRecord, currentNow)) {
        return createStorageError(
          'stale-writer-fenced',
          currentHealth(),
          'Lease acquire was fenced because a live lease already exists.',
        );
      }

      const token = createToken();
      const nextRecordOrError = withLeaseGuard(name, () => ({
        name,
        epoch: (currentRecord?.epoch ?? 0) + 1,
        holder,
        tokenDigest: digestToken(token),
        expiresAt: new Date(currentNow.getTime() + ttlMs),
      }));

      if ('code' in nextRecordOrError) {
        return nextRecordOrError;
      }

      return toLeaseCapability(nextRecordOrError, token);
    },

    renew(name, epoch, token, ttlMs) {
      const availability = guardAuthoritative();
      if (availability !== true) {
        return availability;
      }

      const existing = readLeaseRecord(name);
      const currentNow = now();
      if (
        existing === undefined ||
        isExpired(existing, currentNow) ||
        existing.epoch !== epoch ||
        existing.tokenDigest !== digestToken(token)
      ) {
        return createStorageError(
          'stale-writer-fenced',
          currentHealth(),
          'Lease renew was fenced because the supplied epoch or token is stale.',
        );
      }

      const renewedOrError = withLeaseGuard(name, () => ({
        ...existing,
        expiresAt: new Date(currentNow.getTime() + ttlMs),
      }));
      if ('code' in renewedOrError) {
        return renewedOrError;
      }

      return toLeaseCapability(renewedOrError, token);
    },

    release(name, epoch, token) {
      const availability = guardAuthoritative();
      if (availability !== true) {
        return availability;
      }

      const existing = readLeaseRecord(name);
      if (
        existing === undefined ||
        isExpired(existing, now()) ||
        existing.epoch !== epoch ||
        existing.tokenDigest !== digestToken(token)
      ) {
        return createStorageError(
          'stale-writer-fenced',
          currentHealth(),
          'Lease release was fenced because the supplied epoch or token is stale.',
        );
      }

      const releasedOrError = withLeaseGuard(name, () => ({
        ...existing,
        expiresAt: new Date(0),
      }));
      if ('code' in releasedOrError) {
        return releasedOrError;
      }

      return undefined;
    },

    read(name) {
      const record = readLeaseRecord(name);
      if (record === undefined || isExpired(record, now())) {
        return { health: currentHealth() };
      }
      return {
        snapshot: toLeaseSnapshot(record),
        health: currentHealth(),
      };
    },

    fence(name, epoch, token) {
      const record = readLeaseRecord(name);
      if (record === undefined || isExpired(record, now())) {
        return false;
      }
      return record.epoch === epoch && record.tokenDigest === digestToken(token);
    },
  };
};
