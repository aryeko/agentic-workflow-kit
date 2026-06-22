import type { HostFailure, SpawnWorkerRequest } from '../../../../src/index.js';

import { hostFailureFixture, hostInjectionContextFixture, spawnWorkerRequestFixture } from './shared.js';

export const credentialInjectionRejectedRequest: SpawnWorkerRequest = spawnWorkerRequestFixture({
  injection: hostInjectionContextFixture({
    bindings: [],
  }),
});

export const credentialInjectionRejectedFailure: HostFailure = hostFailureFixture('credential-injection-rejected');
