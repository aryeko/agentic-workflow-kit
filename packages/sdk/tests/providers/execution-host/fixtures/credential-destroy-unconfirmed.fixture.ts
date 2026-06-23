import type { HostObservation, HostReleaseResult } from '../../../../src/index.js';

import { hostFailureObservationFixture, hostReleaseResultFixture } from './shared.js';

export const credentialDestroyUnconfirmedRelease: HostReleaseResult = hostReleaseResultFixture({
  released: false,
  credentialMaterialDestroyed: false,
  evidenceRef: 'artifact://credential-destroy-unconfirmed',
});

export const credentialDestroyUnconfirmedObservation: Extract<HostObservation, { type: 'host-failure' }> =
  hostFailureObservationFixture('credential-destroy-unconfirmed', {
    handleId: undefined,
  });
