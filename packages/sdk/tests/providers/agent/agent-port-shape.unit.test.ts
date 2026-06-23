import { describe, expect, it } from 'vitest';

import type { AgentProvider } from '../../../src/index.js';

import {
  agentProviderFixture,
  agentProbeScopeFixture,
  agentResumeRequestFixture,
  agentSessionFixture,
  agentStartRequestFixture,
  approvalAnswerFixture,
} from './fixtures/shared.js';

describe('prov-01 agent provider shape', () => {
  it('constructs a pure provider with the six required operations', async () => {
    const provider: AgentProvider = agentProviderFixture();
    const session = agentSessionFixture();

    expect(provider.probeCapabilities(agentProbeScopeFixture())).toHaveLength(1);
    expect(provider.startWorker(agentStartRequestFixture())).toBeDefined();
    expect(provider.observe).toBeTypeOf('function');
    expect(provider.answerApproval(session, approvalAnswerFixture()).delivered).toBe(true);
    expect(provider.resumeOwned(agentResumeRequestFixture())).toBeDefined();
    expect(provider.stopObserving(session).observationStopped).toBe(true);
  });

  it('streams normalized observations without real process or network behavior', async () => {
    const provider: AgentProvider = agentProviderFixture();
    const session = agentSessionFixture();
    const events = [];

    for await (const event of provider.observe(session)) {
      events.push(event);
    }

    expect(events).toEqual([
      {
        type: 'linked',
        session,
        at: '2026-06-22T10:12:00.000Z',
      },
    ]);
  });
});
