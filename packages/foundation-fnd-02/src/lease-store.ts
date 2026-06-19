import { existsSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sha256Json, sha256Bytes } from './digest.js';
import { storageError } from './errors.js';
import {
  fsyncDirectory,
  fsyncFile,
  leaseFilePath,
  leaseGuardPath,
  readTextIfExists,
  storageKey,
  writeFileAtomicDurable,
  type StoragePaths,
} from './fs-utils.js';
import type { StorageRootState } from './state.js';
import type {
  FileSystemStorageRootOptions,
  LeaseCapability,
  LeaseReadResult,
  LeaseStore,
  StorageError,
} from './types.js';
import { guardRecordSchema, leaseRecordSchema, type GuardRecord, type LeaseRecord } from './validation.js';

const guardTtlMs = 30_000;

type LeaseOperation = 'acquire' | 'renew' | 'release';
type GuardAcquireResult =
  | { readonly kind: 'acquired' }
  | { readonly kind: 'retry' }
  | { readonly kind: 'blocked'; readonly error: StorageError };

export class FileSystemLeaseStore implements LeaseStore {
  constructor(
    private readonly paths: StoragePaths,
    private readonly state: StorageRootState,
    private readonly options: FileSystemStorageRootOptions,
  ) {}

  acquire(name: string, holder: string, ttlMs: number): LeaseCapability | StorageError {
    const validation = this.validateMutationInput(name, holder, ttlMs);
    if (validation !== undefined) {
      return validation;
    }

    return this.withGuard(name, holder, 'acquire', () => {
      const now = this.options.clock.now();
      const current = this.readRecord(name);
      if (current instanceof Error) {
        return storageError('lease-unavailable', current.message, this.state.health);
      }
      if (current !== undefined && this.isLive(current, now)) {
        return storageError('lease-unavailable', 'lease is already held', this.state.health, { name });
      }

      const token = this.options.tokenGenerator.nextToken(`lease:${name}`);
      const expiresAt = new Date(now.getTime() + ttlMs);
      const nextRecord = withLeaseDigest({
        schema: 'kit-vnext.lease-record.v1',
        name,
        epoch: (current?.epoch ?? 0) + 1,
        holder,
        tokenDigest: tokenDigest(token),
        acquiredAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      });
      const written = this.writeRecord(name, nextRecord);
      if (written !== undefined) {
        return written;
      }
      return { name, epoch: nextRecord.epoch, token, expiresAt };
    });
  }

  renew(name: string, epoch: number, token: string, ttlMs: number): LeaseCapability | StorageError {
    const validation = this.validateMutationInput(name, 'renew', ttlMs);
    if (validation !== undefined) {
      return validation;
    }

    return this.withGuard(name, 'renew', 'renew', () => {
      const current = this.readRecord(name);
      if (current instanceof Error || current === undefined) {
        return storageError('lease-unavailable', 'lease does not exist', this.state.health, { name });
      }
      const now = this.options.clock.now();
      if (!this.isLive(current, now)) {
        return storageError('lease-unavailable', 'lease is already expired', this.state.health, { name, epoch });
      }
      if (!this.matchesCapability(current, epoch, token)) {
        return storageError('lease-unavailable', 'lease epoch or token did not match', this.state.health, {
          name,
          epoch,
        });
      }
      const expiresAt = new Date(now.getTime() + ttlMs);
      const nextRecord = withLeaseDigest({ ...withoutLeaseDigest(current), expiresAt: expiresAt.toISOString() });
      const written = this.writeRecord(name, nextRecord);
      if (written !== undefined) {
        return written;
      }
      return { name, epoch, token, expiresAt };
    });
  }

  release(name: string, epoch: number, token: string): undefined | StorageError {
    if (!this.state.authoritativeWritesAvailable()) {
      return storageError('lease-unavailable', 'lease store is unavailable', this.state.health, { name });
    }

    return this.withGuard(name, 'release', 'release', () => {
      const current = this.readRecord(name);
      if (current instanceof Error || current === undefined) {
        return storageError('lease-unavailable', 'lease does not exist', this.state.health, { name });
      }
      if (!this.matchesCapability(current, epoch, token)) {
        return storageError('lease-unavailable', 'lease epoch or token did not match', this.state.health, {
          name,
          epoch,
        });
      }
      const now = this.options.clock.now().toISOString();
      const nextRecord = withLeaseDigest({ ...withoutLeaseDigest(current), expiresAt: now });
      return this.writeRecord(name, nextRecord);
    });
  }

  read(name: string): LeaseReadResult {
    if (this.state.health === 'network-fs-degraded' || this.state.health === 'unusable') {
      return { health: this.state.health };
    }
    const record = this.readRecord(name);
    if (record instanceof Error || record === undefined) {
      return { health: record instanceof Error ? 'unusable' : this.state.health };
    }
    return {
      health: this.state.health,
      snapshot: {
        name: record.name,
        epoch: record.epoch,
        holder: record.holder,
        tokenDigest: record.tokenDigest,
        expiresAt: new Date(record.expiresAt),
      },
    };
  }

  fence(name: string, epoch: number, token: string): boolean {
    if (!this.state.authoritativeWritesAvailable()) {
      return false;
    }
    const record = this.readRecord(name);
    if (record instanceof Error || record === undefined) {
      return false;
    }
    return this.isLive(record, this.options.clock.now()) && this.matchesCapability(record, epoch, token);
  }

  private validateMutationInput(name: string, holder: string, ttlMs: number): StorageError | undefined {
    if (!this.state.authoritativeWritesAvailable()) {
      return storageError('lease-unavailable', 'lease store is unavailable', this.state.health, { name });
    }
    if (name.length === 0 || holder.length === 0 || !Number.isSafeInteger(ttlMs) || ttlMs <= 0) {
      return storageError('invalid-input', 'lease name, holder, and positive ttl are required', this.state.health);
    }
    return undefined;
  }

  private withGuard<T>(
    name: string,
    holder: string,
    operation: LeaseOperation,
    update: () => T | StorageError,
  ): T | StorageError {
    const guardPath = leaseGuardPath(this.paths, name);
    const operationId = this.options.idGenerator.nextId(`lease-guard:${name}`);
    const guard: GuardRecord = {
      schema: 'kit-vnext.lease-guard.v1',
      name,
      holder,
      operationId,
      operation,
      guardExpiresAt: new Date(this.options.clock.now().getTime() + guardTtlMs).toISOString(),
    };

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const acquired = this.tryAcquireGuard(guardPath, guard);
      if (acquired.kind === 'retry') {
        continue;
      }
      if (acquired.kind === 'blocked') {
        return acquired.error;
      }

      try {
        return update();
      } finally {
        try {
          unlinkSync(guardPath);
          fsyncDirectory(this.paths.leases, this.options.durabilityObserver);
        } catch {
          this.state.mark('network-fs-degraded');
        }
      }
    }

    return storageError(
      'lease-unavailable',
      'lease guard could not be acquired after stale recovery',
      this.state.health,
      {
        name,
      },
    );
  }

  private tryAcquireGuard(path: string, guard: GuardRecord): GuardAcquireResult {
    try {
      writeFileSync(path, `${JSON.stringify(guard)}\n`, { flag: 'wx' });
      fsyncFile(path, this.options.durabilityObserver);
      fsyncDirectory(this.paths.leases, this.options.durabilityObserver);
      return { kind: 'acquired' };
    } catch (error) {
      if (isFileExistsError(error)) {
        return this.recoverStaleGuard(path);
      }
      this.state.mark('network-fs-degraded');
      return {
        kind: 'blocked',
        error: storageError('lease-unavailable', 'could not acquire lease guard', this.state.health),
      };
    }
  }

  private recoverStaleGuard(path: string): GuardAcquireResult {
    const guardText = readTextIfExists(path);
    const parsed = parseGuardText(guardText);
    if (
      parsed === undefined ||
      !parsed.success ||
      Date.parse(parsed.data.guardExpiresAt) > this.options.clock.now().getTime()
    ) {
      return {
        kind: 'blocked',
        error: storageError('lease-unavailable', 'lease guard is still live', this.state.health),
      };
    }

    const stalePath = join(
      this.paths.staleGuards,
      `${storageKey(parsed.data.name)}-${this.options.idGenerator.nextId('stale-guard')}.guard`,
    );
    try {
      renameSync(path, stalePath);
      fsyncDirectory(this.paths.leases, this.options.durabilityObserver);
      fsyncDirectory(this.paths.staleGuards, this.options.durabilityObserver);
      return { kind: 'retry' };
    } catch {
      this.state.mark('network-fs-degraded');
      return {
        kind: 'blocked',
        error: storageError('lease-unavailable', 'could not quarantine stale guard', this.state.health),
      };
    }
  }

  private readRecord(name: string): LeaseRecord | undefined | Error {
    const path = leaseFilePath(this.paths, name);
    if (!existsSync(path)) {
      return undefined;
    }
    try {
      const parsed = leaseRecordSchema.parse(JSON.parse(readTextIfExists(path) ?? '{}'));
      const expectedDigest = sha256Json(withoutLeaseDigest(parsed));
      if (expectedDigest !== parsed.recordDigest) {
        return new Error('lease record digest mismatch');
      }
      return parsed;
    } catch (error) {
      return error instanceof Error ? error : new Error('lease record is invalid');
    }
  }

  private writeRecord(name: string, record: LeaseRecord): StorageError | undefined {
    try {
      writeFileAtomicDurable(
        leaseFilePath(this.paths, name),
        `${JSON.stringify(record)}\n`,
        join(this.paths.leases, `${storageKey(name)}.${this.options.idGenerator.nextId('lease-record')}.tmp`),
        this.options.durabilityObserver,
      );
      return undefined;
    } catch {
      this.state.mark('network-fs-degraded');
      return storageError('lease-unavailable', 'could not commit lease record', this.state.health, { name });
    }
  }

  private isLive(record: LeaseRecord, now: Date): boolean {
    return Date.parse(record.expiresAt) > now.getTime();
  }

  private matchesCapability(record: LeaseRecord, epoch: number, token: string): boolean {
    return record.epoch === epoch && record.tokenDigest === tokenDigest(token);
  }
}

export const tokenDigest = (token: string): string => sha256Bytes(token);

const withoutLeaseDigest = (
  record: Omit<LeaseRecord, 'recordDigest'> | LeaseRecord,
): Omit<LeaseRecord, 'recordDigest'> => {
  const { recordDigest: _recordDigest, ...rest } = record as LeaseRecord;
  return rest;
};

const withLeaseDigest = (record: Omit<LeaseRecord, 'recordDigest'>): LeaseRecord => ({
  ...record,
  recordDigest: sha256Json(record),
});

const isFileExistsError = (error: unknown): boolean =>
  typeof error === 'object' && error !== null && (error as { code?: unknown }).code === 'EEXIST';

const parseGuardText = (text: string | undefined): ReturnType<typeof guardRecordSchema.safeParse> | undefined => {
  if (text === undefined) {
    return undefined;
  }
  try {
    return guardRecordSchema.safeParse(JSON.parse(text));
  } catch {
    return undefined;
  }
};
