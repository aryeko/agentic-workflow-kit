import type { AgentFailure } from '../../../../src/index.js';

import { agentFailureFixture } from './shared.js';

export const agentResumeUnattestedFixture = agentFailureFixture('agent-resume-unattested', {
  message: 'Agent resume capability was not freshly attested.',
  retryable: false,
}) satisfies AgentFailure;
