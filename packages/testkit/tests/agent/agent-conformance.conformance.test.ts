import { describe, expect, it } from 'vitest';

import type { AgentProvider } from 'sdk';

import {
  agentApprovalAnswerFixture,
  agentApprovalRequestFixture,
  agentConformance,
  agentIncidentFixtures,
  agentProbeScopeFixture,
  agentStartRequestFixture,
  createMockAgentProvider,
  mockAgentScenarioFixture,
} from '../../src/index.js';

const approvalRequest = agentApprovalRequestFixture();

const conformantProvider = () =>
  createMockAgentProvider({
    scenario: mockAgentScenarioFixture({
      events: [
        { atMs: 0, emit: 'linked', providerSessionId: 'provider-session-01' },
        { atMs: 1, emit: 'progress', message: 'started' },
        { atMs: 2, emit: 'approval-requested', request: approvalRequest },
        { atMs: 3, emit: 'tool-observed', tool: { observationId: 'tool-01', exitCode: 0, outputBytes: 'ok' } },
        {
          atMs: 4,
          emit: 'guardian-review',
          review: {
            reviewId: 'guardian-01',
            targetItemId: 'tool-01',
            actionType: 'command',
            status: 'approved',
            stable: true,
          },
        },
        { atMs: 5, emit: 'terminal', reason: 'completed', exitCode: 0 },
      ],
    }),
  });

const approvalBlockingProvider = (): AgentProvider => {
  const provider = conformantProvider();
  let answered = false;

  return {
    ...provider,
    answerApproval: (session, _answer) => {
      answered = true;
      return {
        delivered: true,
        persisted: true,
        channelRef: approvalRequest.answerChannel.channelRef,
        evidenceRef: approvalRequest.answerChannel.evidenceRef,
        at: session.startedAt,
      };
    },
    observe: async function* observe(session) {
      yield { type: 'linked', session, at: session.startedAt };
      yield {
        type: 'approval-requested',
        sessionId: session.sessionId,
        request: approvalRequest,
        at: session.startedAt,
      };
      if (!answered) {
        yield {
          type: 'degraded',
          sessionId: session.sessionId,
          failure: {
            reason: 'approval-answer-channel-lost',
            message: 'Approval was not answered before observation continued.',
            retryable: false,
          },
          at: session.startedAt,
        };
        yield { type: 'terminal', sessionId: session.sessionId, reason: 'failed', at: session.startedAt };
        return;
      }
      yield {
        type: 'tool-observed',
        sessionId: session.sessionId,
        tool: {
          observationId: 'tool-approval-gated',
          command: 'pnpm check',
          exitCode: 0,
          outputRef: 'artifact://testkit/agent/approval-gated/tool-output',
          outputDigest: 'sha256:approval-gated',
          source: 'agent',
        },
        at: session.startedAt,
      };
      yield {
        type: 'guardian-review',
        sessionId: session.sessionId,
        review: {
          reviewId: 'guardian-approval-gated',
          targetItemId: 'tool-approval-gated',
          actionType: 'command',
          status: 'approved',
          stable: true,
        },
        at: session.startedAt,
      };
      yield { type: 'terminal', sessionId: session.sessionId, reason: 'completed', exitCode: 0, at: session.startedAt };
    },
  };
};

describe('agent conformance helper', () => {
  it('passes a conformant mock and enumerates behavior checks', async () => {
    const result = await agentConformance({
      provider: conformantProvider(),
      probeScope: agentProbeScopeFixture({
        capabilities: [
          'emitsStructuredToolExit',
          'emitsGuardianReview',
          'canRelayApproval',
          'canPersistApprovalAnswerChannel',
          'canResumeOwned',
          'preservesHostProcessParentage',
        ],
      }),
      startRequest: agentStartRequestFixture(),
      approvalAnswer: agentApprovalAnswerFixture({ requestId: approvalRequest.requestId }),
    });

    expect(result.passed).toBe(true);
    expect(result.checks.map((check) => check.check)).toEqual(
      expect.arrayContaining(['structured-tool-exit', 'guardian-review', 'approval-relay', 'resume-owned']),
    );
  });

  it('fails broken tool, guardian, and stale capability fixtures with named tokens', async () => {
    const brokenTool = await agentConformance({
      provider: createMockAgentProvider({
        scenario: mockAgentScenarioFixture({
          events: [
            { atMs: 0, emit: 'linked', providerSessionId: 'provider-session-01' },
            { atMs: 1, emit: 'tool-observed', tool: { observationId: 'tool-01', outputRef: '' } },
            { atMs: 2, emit: 'terminal', reason: 'completed' },
          ],
        }),
      }),
      probeScope: agentProbeScopeFixture({ capabilities: ['emitsStructuredToolExit'] }),
      startRequest: agentStartRequestFixture(),
      approvalAnswer: agentApprovalAnswerFixture(),
    });
    const staleCapabilities = await agentConformance({
      provider: conformantProvider(),
      probeScope: agentProbeScopeFixture({
        capabilities: ['emitsStructuredToolExit'],
        freshnessKey: 'different-freshness-key',
      }),
      startRequest: agentStartRequestFixture(),
      approvalAnswer: agentApprovalAnswerFixture({ requestId: approvalRequest.requestId }),
    });

    expect(brokenTool.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ token: 'structured-tool-exit-missing' })]),
    );
    expect(staleCapabilities.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ token: 'agent-capability-unattested' })]),
    );
  });

  it('answers approval requests while the observation stream is still active', async () => {
    const result = await agentConformance({
      provider: approvalBlockingProvider(),
      probeScope: agentProbeScopeFixture({
        capabilities: [
          'emitsStructuredToolExit',
          'emitsGuardianReview',
          'canRelayApproval',
          'canPersistApprovalAnswerChannel',
          'canResumeOwned',
          'preservesHostProcessParentage',
        ],
      }),
      startRequest: agentStartRequestFixture(),
      approvalAnswer: agentApprovalAnswerFixture({ requestId: approvalRequest.requestId }),
    });

    expect(result.passed).toBe(true);
    expect(result.checks).toEqual(
      expect.arrayContaining([expect.objectContaining({ check: 'approval-answer-channel' })]),
    );
  });

  it('exposes typed incident replay inputs', () => {
    expect(Object.values(agentIncidentFixtures).map((fixture) => fixture.fixtureId)).toEqual(
      expect.arrayContaining(['structured-tool-exit-missing', 'guardian-review-untrusted', 'agent-linkage-lost']),
    );
  });
});
