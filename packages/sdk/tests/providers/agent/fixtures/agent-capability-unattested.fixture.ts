import type { AgentFailure } from '../../../../src/index.js';

import { agentFailureFixture } from './shared.js';

export const agentCapabilityUnattestedFixture = agentFailureFixture('agent-capability-unattested', {
  message: 'Agent capability was not freshly attested.',
  retryable: false,
}) satisfies AgentFailure;
