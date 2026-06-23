import type { AgentFailure } from '../../../../src/index.js';

import { agentFailureFixture } from './shared.js';

export const agentTerminalAmbiguousFixture = agentFailureFixture('agent-terminal-ambiguous', {
  message: 'Agent terminal outcome was ambiguous.',
  retryable: false,
}) satisfies AgentFailure;
