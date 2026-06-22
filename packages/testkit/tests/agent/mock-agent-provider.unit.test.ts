import { describe, expect, it } from 'vitest';

import type { AgentEvent, AgentFailure, AgentProvider } from 'sdk';

import {
  agentApprovalAnswerFixture,
  agentApprovalRequestFixture,
  agentProbeScopeFixture,
  agentStartRequestFixture,
  agentWorkerHandleFixture,
  createMockAgentOutputSink,
  createMockAgentProvider,
  isAgentFailure,
  mockAgentScenarioFixture,
  scopedGrantFixture,
} from '../../src/index.js';

const collectEvents = async (events: AsyncIterable<AgentEvent>): Promise<readonly AgentEvent[]> => {
  const collected: AgentEvent[] = [];

  for await (const event of events) {
    collected.push(event);
  }

  return collected;
};

describe('agent mock testkit provider', () => {
  it('scripts capability attestations and a positive worker lifecycle', async () => {
    const outputSink = createMockAgentOutputSink();
    const approvalRequest = agentApprovalRequestFixture();
    const provider: AgentProvider = createMockAgentProvider({
      scenario: mockAgentScenarioFixture({
        events: [
          { atMs: 0, emit: 'linked', providerSessionId: 'provider-session-01' },
          { atMs: 1, emit: 'progress', message: 'planning implementation' },
          { atMs: 2, emit: 'approval-requested', request: approvalRequest },
          {
            atMs: 3,
            emit: 'tool-observed',
            tool: {
              observationId: 'tool-01',
              itemId: 'item-tool-01',
              command: 'pnpm --filter testkit test',
              exitCode: 0,
              outputBytes: 'tests passed',
            },
          },
          {
            atMs: 4,
            emit: 'guardian-review',
            review: {
              reviewId: 'guardian-01',
              targetItemId: 'item-tool-01',
              actionType: 'command',
              status: 'approved',
              stable: true,
            },
          },
          { atMs: 5, emit: 'terminal', reason: 'completed', exitCode: 0 },
        ],
      }),
    });

    const attestations = provider.probeCapabilities(
      agentProbeScopeFixture({
        capabilities: [
          'canRelayApproval',
          'canPersistApprovalAnswerChannel',
          'canResumeOwned',
          'emitsStructuredToolExit',
          'emitsGuardianReview',
          'preservesHostProcessParentage',
        ],
      }),
    );
    const session = provider.startWorker(agentStartRequestFixture({ outputSink }));

    expect(attestations.map((attestation) => [attestation.capability, attestation.result])).toEqual([
      ['canRelayApproval', 'positive'],
      ['canPersistApprovalAnswerChannel', 'positive'],
      ['canResumeOwned', 'positive'],
      ['emitsStructuredToolExit', 'positive'],
      ['emitsGuardianReview', 'positive'],
      ['preservesHostProcessParentage', 'positive'],
    ]);
    expect(isAgentFailure(session)).toBe(false);
    if (isAgentFailure(session)) {
      throw new Error(session.message);
    }

    const events = await collectEvents(provider.observe(session));
    const answer = provider.answerApproval(
      session,
      agentApprovalAnswerFixture({
        requestId: approvalRequest.requestId,
        grant: scopedGrantFixture({ kind: 'command-once' }),
      }),
    );
    const release = provider.stopObserving(session);

    expect(events.map((event) => event.type)).toEqual([
      'linked',
      'progress',
      'approval-requested',
      'tool-observed',
      'guardian-review',
      'terminal',
    ]);
    expect(events[0]).toEqual(
      expect.objectContaining({
        type: 'linked',
        session: expect.objectContaining({
          providerSessionId: 'provider-session-01',
          hostWorkerHandleId: 'worker-handle-01',
        }),
      }),
    );
    expect(events[3]).toEqual(
      expect.objectContaining({
        type: 'tool-observed',
        tool: expect.objectContaining({
          command: 'pnpm --filter testkit test',
          exitCode: 0,
          outputRef: 'artifact://testkit/agent/tool-output/tool-01',
          outputDigest: expect.stringMatching(/^sha256:mock-/),
          source: 'agent',
        }),
      }),
    );
    expect(outputSink.getRecords()).toEqual([
      expect.objectContaining({
        runId: 'run-01',
        toolObservationId: 'tool-01',
        bytes: 'tests passed',
        redactionSetId: 'redaction-set-01',
      }),
    ]);
    expect(answer).toEqual(
      expect.objectContaining({
        delivered: true,
        persisted: true,
        channelRef: approvalRequest.answerChannel.channelRef,
      }),
    );
    expect(release).toEqual(
      expect.objectContaining({
        sessionId: session.sessionId,
        released: true,
        observationStopped: true,
      }),
    );
  });

  it('persists, drops, and refuses approval answers according to scripted channel rules', async () => {
    const request = agentApprovalRequestFixture({ requestId: 'approval-drop-01' });
    const provider = createMockAgentProvider({
      scenario: mockAgentScenarioFixture({
        events: [
          { atMs: 0, emit: 'linked', providerSessionId: 'provider-session-01' },
          { atMs: 1, emit: 'approval-requested', request },
          { atMs: 2, emit: 'terminal', reason: 'approval-parked' },
        ],
        answerRules: {
          [request.requestId]: {
            accepts: ['command-once'],
            persistable: true,
            dropAnswer: true,
          },
        },
      }),
    });
    const session = provider.startWorker(agentStartRequestFixture());

    expect(isAgentFailure(session)).toBe(false);
    if (isAgentFailure(session)) {
      throw new Error(session.message);
    }

    await collectEvents(provider.observe(session));

    expect(
      provider.answerApproval(
        session,
        agentApprovalAnswerFixture({
          requestId: request.requestId,
          grant: scopedGrantFixture({ kind: 'command-once' }),
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        delivered: false,
        persisted: false,
      }),
    );
    expect(
      provider.answerApproval(
        session,
        agentApprovalAnswerFixture({
          requestId: request.requestId,
          grant: scopedGrantFixture({ kind: 'network-permission' }),
        }),
      ),
    ).toEqual(
      expect.objectContaining({
        delivered: false,
        persisted: false,
      }),
    );
  });

  it('rejects approval answers from stale sessions or after lost linkage', async () => {
    const request = agentApprovalRequestFixture({ requestId: 'approval-live-session-01' });
    const provider = createMockAgentProvider({
      scenario: mockAgentScenarioFixture({
        events: [
          { atMs: 0, emit: 'linked', providerSessionId: 'provider-session-01' },
          { atMs: 1, emit: 'approval-requested', request },
          { atMs: 2, emit: 'drop-connection' },
        ],
      }),
    });
    const session = provider.startWorker(agentStartRequestFixture());

    expect(isAgentFailure(session)).toBe(false);
    if (isAgentFailure(session)) {
      throw new Error(session.message);
    }

    await collectEvents(provider.observe(session));

    expect(
      provider.answerApproval(
        { ...session, sessionId: 'agent-session-stale' },
        agentApprovalAnswerFixture({
          requestId: request.requestId,
          grant: scopedGrantFixture({ kind: 'command-once' }),
        }),
      ),
    ).toMatchObject({ delivered: false, persisted: false });
    expect(
      provider.answerApproval(
        session,
        agentApprovalAnswerFixture({
          requestId: request.requestId,
          grant: scopedGrantFixture({ kind: 'command-once' }),
        }),
      ),
    ).toMatchObject({ delivered: false, persisted: false });
  });

  it('resumes only owned sessions when canResumeOwned is positively attested', () => {
    const provider = createMockAgentProvider();
    const started = provider.startWorker(agentStartRequestFixture());

    expect(isAgentFailure(started)).toBe(false);
    if (isAgentFailure(started)) {
      throw new Error(started.message);
    }

    const resumed = provider.resumeOwned({
      providerSessionId: started.providerSessionId,
      runId: started.runId,
      operationId: 'op-resume-01',
      ownershipClass: 'owned',
      hostWorker: agentWorkerHandleFixture({
        handleId: 'worker-handle-resume-01',
        operationId: 'op-resume-01',
      }),
    });
    const unattested = createMockAgentProvider({
      scenario: mockAgentScenarioFixture({
        capabilities: {
          canResumeOwned: 'negative',
        },
      }),
    }).resumeOwned({
      providerSessionId: started.providerSessionId,
      runId: started.runId,
      operationId: 'op-resume-02',
      ownershipClass: 'owned',
      hostWorker: agentWorkerHandleFixture({
        handleId: 'worker-handle-resume-02',
        operationId: 'op-resume-02',
      }),
    });

    expect(isAgentFailure(resumed)).toBe(false);
    if (isAgentFailure(resumed)) {
      throw new Error(resumed.message);
    }
    expect(resumed).toEqual(
      expect.objectContaining({
        providerSessionId: started.providerSessionId,
        hostWorkerHandleId: 'worker-handle-resume-01',
        ownershipClass: 'owned',
      }),
    );
    expect(unattested).toEqual(
      expect.objectContaining<Partial<AgentFailure>>({
        reason: 'agent-resume-unattested',
        retryable: false,
      }),
    );
  });

  it('emits fail-closed degraded events for lost linkage and duplicate terminal signals', async () => {
    const provider = createMockAgentProvider({
      scenario: mockAgentScenarioFixture({
        events: [
          { atMs: 0, emit: 'progress', message: 'progress without linkage' },
          { atMs: 1, emit: 'terminal', reason: 'completed' },
          { atMs: 2, emit: 'terminal', reason: 'failed' },
        ],
      }),
    });
    const session = provider.startWorker(agentStartRequestFixture());

    expect(isAgentFailure(session)).toBe(false);
    if (isAgentFailure(session)) {
      throw new Error(session.message);
    }

    const events = await collectEvents(provider.observe(session));

    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'degraded',
        failure: expect.objectContaining({ reason: 'agent-linkage-lost' }),
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'degraded',
        failure: expect.objectContaining({ reason: 'agent-terminal-ambiguous' }),
      }),
    );
    expect(events.filter((event) => event.type === 'terminal')).toHaveLength(1);
  });

  it('degrades missing structured tool exits and output references instead of fabricating evidence', async () => {
    const provider = createMockAgentProvider({
      scenario: mockAgentScenarioFixture({
        events: [
          { atMs: 0, emit: 'linked', providerSessionId: 'provider-session-01' },
          {
            atMs: 1,
            emit: 'tool-observed',
            tool: {
              observationId: 'tool-missing-exit',
              command: 'pnpm check',
              outputBytes: 'command output',
            },
          },
          {
            atMs: 2,
            emit: 'tool-observed',
            tool: {
              observationId: 'tool-missing-output-ref',
              command: 'pnpm check',
              exitCode: 0,
            },
          },
          { atMs: 3, emit: 'terminal', reason: 'failed', exitCode: 1 },
        ],
      }),
    });
    const session = provider.startWorker(agentStartRequestFixture());

    expect(isAgentFailure(session)).toBe(false);
    if (isAgentFailure(session)) {
      throw new Error(session.message);
    }

    const events = await collectEvents(provider.observe(session));

    expect(events.filter((event) => event.type === 'tool-observed')).toEqual([]);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'degraded',
        failure: expect.objectContaining({ reason: 'structured-tool-exit-missing' }),
      }),
    );
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'degraded',
        failure: expect.objectContaining({ reason: 'tool-output-ref-missing' }),
      }),
    );
  });

  it('stops observation streams after release', async () => {
    const provider = createMockAgentProvider();
    const session = provider.startWorker(agentStartRequestFixture());

    expect(isAgentFailure(session)).toBe(false);
    if (isAgentFailure(session)) {
      throw new Error(session.message);
    }

    provider.stopObserving(session);

    await expect(collectEvents(provider.observe(session))).resolves.toEqual([]);
  });

  it('fails closed when host parentage is unproven or tool fields are null', async () => {
    const parentageProvider = createMockAgentProvider({
      scenario: mockAgentScenarioFixture({
        events: [
          { atMs: 0, emit: 'linked', providerSessionId: 'provider-session-01' },
          {
            atMs: 1,
            emit: 'tool-observed',
            tool: {
              observationId: 'tool-unproven-parentage',
              command: 'pnpm check',
              exitCode: 0,
              outputRef: 'artifact://tool-output',
              outputDigest: 'sha256:tool-output',
            },
          },
        ],
      }),
    });
    const parentageSession = parentageProvider.startWorker(
      agentStartRequestFixture({
        hostWorker: agentWorkerHandleFixture({
          ownershipClass: 'observe-only',
          containmentRef: '',
        }),
      }),
    );

    expect(isAgentFailure(parentageSession)).toBe(false);
    if (isAgentFailure(parentageSession)) {
      throw new Error(parentageSession.message);
    }
    await expect(collectEvents(parentageProvider.observe(parentageSession))).resolves.toContainEqual(
      expect.objectContaining({
        type: 'degraded',
        failure: expect.objectContaining({ reason: 'host-parentage-unproven' }),
      }),
    );

    const nullToolProvider = createMockAgentProvider({
      scenario: mockAgentScenarioFixture({
        events: [
          { atMs: 0, emit: 'linked', providerSessionId: 'provider-session-01' },
          {
            atMs: 1,
            emit: 'tool-observed',
            tool: {
              observationId: 'tool-null-exit',
              command: 'pnpm check',
              exitCode: null,
              outputBytes: 'output',
            } as never,
          },
          {
            atMs: 2,
            emit: 'tool-observed',
            tool: {
              observationId: 'tool-null-output',
              command: 'pnpm check',
              exitCode: 0,
              outputRef: null,
              outputDigest: null,
            } as never,
          },
        ],
      }),
    });
    const nullToolSession = nullToolProvider.startWorker(agentStartRequestFixture());

    expect(isAgentFailure(nullToolSession)).toBe(false);
    if (isAgentFailure(nullToolSession)) {
      throw new Error(nullToolSession.message);
    }
    const nullToolEvents = await collectEvents(nullToolProvider.observe(nullToolSession));

    expect(nullToolEvents).toContainEqual(
      expect.objectContaining({
        type: 'degraded',
        failure: expect.objectContaining({ reason: 'structured-tool-exit-missing' }),
      }),
    );
    expect(nullToolEvents).toContainEqual(
      expect.objectContaining({
        type: 'degraded',
        failure: expect.objectContaining({ reason: 'tool-output-ref-missing' }),
      }),
    );
  });

  it('runs entirely in memory with no process, network, filesystem, or Codex provider dependency', async () => {
    const provider = createMockAgentProvider();
    const session = provider.startWorker(agentStartRequestFixture());

    expect(isAgentFailure(session)).toBe(false);
    if (isAgentFailure(session)) {
      throw new Error(session.message);
    }

    await expect(collectEvents(provider.observe(session))).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'linked' }),
        expect.objectContaining({ type: 'terminal' }),
      ]),
    );
  });
});
