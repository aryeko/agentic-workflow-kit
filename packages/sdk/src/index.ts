export * from './foundation/configuration-policy/index.js';
export {
  AUTHORITATIVE_STORAGE_OPERATIONS,
  getStorageCapabilityMatrix,
  getStorageHealthSemantics,
  requireAuthoritativeStorageOperation,
  STORAGE_ERROR_CODES,
  STORAGE_HEALTH_STATES,
} from './foundation/storage/index.js';
export type {
  AuthoritativeStorageOperation,
  Result,
  StorageCapabilityMatrix,
  StorageError,
  StorageErrorCode,
  StorageHealth,
  StorageHealthSemantics,
} from './foundation/storage/index.js';
