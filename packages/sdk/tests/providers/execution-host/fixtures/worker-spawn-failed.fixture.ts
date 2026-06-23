import type { HostFailure, SpawnWorkerRequest } from '../../../../src/index.js';

import { hostFailureFixture, spawnWorkerRequestFixture, workerLaunchFixture } from './shared.js';

export const workerSpawnFailedRequest: SpawnWorkerRequest = spawnWorkerRequestFixture({
  launch: workerLaunchFixture({
    executableRef: 'artifact://missing-agent-binary',
  }),
});

export const workerSpawnFailedFailure: HostFailure = hostFailureFixture('worker-spawn-failed');
