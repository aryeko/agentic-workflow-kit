import type { StorageError, StorageErrorCode, StorageHealth } from './types.js';

export const storageError = (
  code: StorageErrorCode,
  message: string,
  health: StorageHealth,
  details?: Record<string, unknown>,
): StorageError => ({
  kind: 'storage-error',
  code,
  message,
  health,
  ...(details === undefined ? {} : { details }),
});

export const healthToErrorCode = (health: StorageHealth): StorageErrorCode => {
  if (health === 'network-fs-degraded') {
    return 'network-fs-degraded';
  }
  if (health === 'log-interior-corrupt') {
    return 'log-interior-corrupt';
  }
  return 'storage-unavailable';
};
