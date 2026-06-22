import type { StorageError } from '../errors/index.js';
import type { StorageHealth } from '../health/index.js';

export type LeaseCapability = {
  readonly name: string;
  readonly epoch: number;
  readonly token: string;
  readonly expiresAt: Date;
};

export type LeaseSnapshot = {
  readonly name: string;
  readonly epoch: number;
  readonly holder: string;
  readonly tokenDigest: string;
  readonly expiresAt: Date;
};

export interface LeaseStore {
  acquire(name: string, holder: string, ttlMs: number): LeaseCapability | StorageError;
  renew(name: string, epoch: number, token: string, ttlMs: number): LeaseCapability | StorageError;
  release(name: string, epoch: number, token: string): void | StorageError;
  read(name: string): { readonly snapshot?: LeaseSnapshot; readonly health: StorageHealth };
  fence(name: string, epoch: number, token: string): boolean;
}

export type LeaseStoreDependencies = {
  readonly now: () => Date;
  readonly createToken: () => string;
  readonly digestToken: (token: string) => string;
  readonly health?: StorageHealth;
};
