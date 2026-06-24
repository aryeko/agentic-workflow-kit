import type { RunLaunchProjection } from '../../../../src/index.js';

const invalidLaunchProjection: RunLaunchProjection = {
  policyDigest: 'sha256:policy',
  taskSnapshotDigest: 'sha256:task-snapshot',
  linkage: 'drifted',
  linkHistory: [],
};

void invalidLaunchProjection;
