export const STORAGE_CONFORMANCE_FIXTURE_CATALOG = Object.freeze([
  'probe-matrix',
  'degraded-open',
  'append-replay-equivalence',
  'lease-fencing',
  'lease-unavailable-guarded-update',
  'artifact-immutability',
  'redaction-tombstones',
  'scratch-refs',
  'export-verification-refusal',
  'storage-degradation',
  'lane-guard',
] as const);

export type StorageConformanceFixtureName = (typeof STORAGE_CONFORMANCE_FIXTURE_CATALOG)[number];
