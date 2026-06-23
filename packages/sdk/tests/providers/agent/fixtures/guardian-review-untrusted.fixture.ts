import type { AgentFailure } from '../../../../src/index.js';

import { agentFailureFixture } from './shared.js';

export const guardianReviewUntrustedFixture = agentFailureFixture('guardian-review-untrusted', {
  message: 'Guardian review was not stable enough to trust.',
  retryable: false,
}) satisfies AgentFailure;
