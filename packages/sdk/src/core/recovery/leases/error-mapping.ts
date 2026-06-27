import type { StorageError } from '../../../foundation/storage/index.js';
import type { StoryLaunchFailureState } from './types.js';

export const mapLeaseStoreAcquireFailure = (
  storageError: StorageError,
): {
  readonly reason: 'lease-store-unavailable';
  readonly failureState: Extract<StoryLaunchFailureState, 'lease-unavailable' | 'launch-duplicate-active'>;
  readonly storageError: StorageError;
} => ({
  reason: 'lease-store-unavailable',
  failureState: storageError.code === 'stale-writer-fenced' ? 'launch-duplicate-active' : 'lease-unavailable',
  storageError,
});
