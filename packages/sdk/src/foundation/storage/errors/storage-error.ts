import type { StorageHealth } from '../health/storage-health-types.js';

export const STORAGE_ERROR_CODES = Object.freeze([
  'stale-writer-fenced',
  'lease-unavailable',
  'log-tail-repaired',
  'log-interior-corrupt',
  'artifact-quarantined',
  'export-incomplete-forbidden',
  'network-fs-degraded',
] as const);

export type StorageErrorCode = (typeof STORAGE_ERROR_CODES)[number];

export type StorageError = {
  readonly code: StorageErrorCode;
  readonly message: string;
  readonly health: StorageHealth;
};
