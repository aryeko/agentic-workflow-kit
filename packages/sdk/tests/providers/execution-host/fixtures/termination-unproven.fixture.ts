import type { HostObservation, TerminationResult } from '../../../../src/index.js';

import { hostFailureObservationFixture, terminationResultFixture } from './shared.js';

export const terminationUnprovenResult: TerminationResult = terminationResultFixture({
  proof: {
    signalSent: true,
    graceObserved: true,
    forceKillSent: true,
    reaped: true,
    containmentEmpty: false,
    evidenceRef: 'artifact://termination-unproven',
    checkedAt: '2026-06-22T10:11:00.000Z',
  },
});

export const terminationUnprovenObservation: Extract<HostObservation, { type: 'host-failure' }> =
  hostFailureObservationFixture('termination-unproven');
