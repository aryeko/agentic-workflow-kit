import { describe, expect, it } from 'vitest';

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

  it('exposes typed incident replay inputs', () => {
    expect(Object.values(agentIncidentFixtures).map((fixture) => fixture.fixtureId)).toEqual(
      expect.arrayContaining(['structured-tool-exit-missing', 'guardian-review-untrusted', 'agent-linkage-lost']),
    );
  });
});
