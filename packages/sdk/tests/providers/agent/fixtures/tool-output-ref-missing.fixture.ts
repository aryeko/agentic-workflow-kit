import type { AgentFailure } from '../../../../src/index.js';

import { agentFailureFixture } from './shared.js';

export const toolOutputRefMissingFixture = agentFailureFixture('tool-output-ref-missing', {
  message: 'Tool output reference was missing.',
  retryable: false,
}) satisfies AgentFailure;
