export {
  createFakeFilesystemBackend,
  createFaultInjectingFilesystemBackend,
  createLocalFilesystemBackend,
} from './filesystem-backends.js';
export { openFilesystemStorage } from './filesystem-storage.js';
export { FILESYSTEM_PROBES } from './filesystem-types.js';
export type {
  FilesystemBackend,
  FilesystemFaultOperation,
  FilesystemFaultRule,
  FilesystemProbe,
  FilesystemProbeResult,
  FilesystemStorage,
  FilesystemStorageDebug,
  OpenFilesystemStorageOptions,
} from './filesystem-types.js';
