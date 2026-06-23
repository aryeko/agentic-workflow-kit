import type { AgentFailure } from '../../../../src/index.js';

import { agentFailureFixture } from './shared.js';

export const hostParentageUnprovenFixture = agentFailureFixture('host-parentage-unproven', {
  message: 'Host process parentage could not be proven.',
  retryable: false,
}) satisfies AgentFailure;
