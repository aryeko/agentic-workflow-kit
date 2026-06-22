import type { HostCommandRequest, HostFailure } from '../../../../src/index.js';

import { hostCommandRequestFixture, hostFailureFixture } from './shared.js';

export const egressConfinementUnattestedRequest: HostCommandRequest = hostCommandRequestFixture({
  kind: 'diagnostic',
});

export const egressConfinementUnattestedFailure: HostFailure = hostFailureFixture('egress-confinement-unattested');
