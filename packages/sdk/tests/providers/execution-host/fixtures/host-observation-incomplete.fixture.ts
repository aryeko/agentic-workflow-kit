import type { HostObservation } from '../../../../src/index.js';

import { hostFailureObservationFixture } from './shared.js';

export const hostObservationIncompleteObservation: Extract<HostObservation, { type: 'host-failure' }> =
  hostFailureObservationFixture('host-observation-incomplete');
