import type { AgentFailure } from '../../../../src/index.js';

import { agentFailureFixture } from './shared.js';

export const structuredToolExitMissingFixture = agentFailureFixture('structured-tool-exit-missing', {
  message: 'Structured tool exit was missing from the observation.',
  retryable: false,
}) satisfies AgentFailure;
