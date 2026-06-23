import type { HostCommandRequest, HostFailure } from '../../../../src/index.js';

import { hostCommandRequestFixture, hostFailureFixture } from './shared.js';

export const workspaceCwdOutsideMountRequest: HostCommandRequest = hostCommandRequestFixture({
  cwd: '/tmp/worktrees/run-01/../../escape',
});

export const workspaceCwdOutsideMountFailure: HostFailure = hostFailureFixture('workspace-cwd-outside-mount');
