import type { AgentFailure } from '../../../../src/index.js';

import { agentFailureFixture } from './shared.js';

export const approvalAnswerChannelLostFixture = agentFailureFixture('approval-answer-channel-lost', {
  message: 'Approval answer channel could not be reached.',
  retryable: true,
}) satisfies AgentFailure;
