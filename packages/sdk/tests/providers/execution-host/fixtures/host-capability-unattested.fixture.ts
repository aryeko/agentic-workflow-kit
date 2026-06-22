import type { HostFailure } from '../../../../src/index.js';

import { hostFailureFixture, hostProbeScopeFixture } from './shared.js';

export const hostCapabilityUnattestedScope = hostProbeScopeFixture({
  capabilities: ['canKill'],
});

export const hostCapabilityUnattestedFailure: HostFailure = hostFailureFixture('host-capability-unattested');
