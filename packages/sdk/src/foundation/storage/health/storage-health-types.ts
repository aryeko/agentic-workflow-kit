export const STORAGE_HEALTH_STATES = Object.freeze([
  'ok',
  'log-tail-repaired',
  'log-interior-corrupt',
  'network-fs-degraded',
  'read-only',
  'unusable',
] as const);

export type StorageHealth = (typeof STORAGE_HEALTH_STATES)[number];
