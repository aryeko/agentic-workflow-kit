import type { AgentFailure } from '../../../../src/index.js';

import { agentFailureFixture } from './shared.js';

export const approvalRelayUnattestedFixture = agentFailureFixture('approval-relay-unattested', {
  message: 'Approval relay capability was not freshly attested.',
  retryable: false,
}) satisfies AgentFailure;
