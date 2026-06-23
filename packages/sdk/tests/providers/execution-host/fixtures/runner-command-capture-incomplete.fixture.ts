import type { HostFailure } from '../../../../src/index.js';

import { hostCommandRequestFixture, hostFailureFixture } from './shared.js';

export const runnerCommandCaptureIncompleteRequest = hostCommandRequestFixture({
  kind: 'repo-setup',
});

export const runnerCommandCaptureIncompleteFailure: HostFailure = hostFailureFixture(
  'runner-command-capture-incomplete',
);
