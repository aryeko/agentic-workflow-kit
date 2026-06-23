import type { AgentFailure } from '../../../../src/index.js';

import { agentFailureFixture } from './shared.js';

export const agentLinkageLostFixture = agentFailureFixture('agent-linkage-lost', {
  message: 'Agent provider linkage was lost.',
  retryable: true,
}) satisfies AgentFailure;
