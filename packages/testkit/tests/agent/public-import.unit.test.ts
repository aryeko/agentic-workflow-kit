import { describe, expect, it } from 'vitest';

import type { AgentProvider } from 'sdk';

import { agentStartRequestFixture, createMockAgentProvider, isAgentFailure } from '../../src/index.js';

describe('testkit Agent public import surface', () => {
  it('exports an AgentProvider-compatible mock and fixtures', () => {
    const provider: AgentProvider = createMockAgentProvider();
    const session = provider.startWorker(agentStartRequestFixture());

    expect(typeof createMockAgentProvider).toBe('function');
    expect(isAgentFailure(session)).toBe(false);
    if (isAgentFailure(session)) {
      throw new Error(session.message);
    }
    expect(session.providerSessionId).toBe('provider-session-01');
  });
});
