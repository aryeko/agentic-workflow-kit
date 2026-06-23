import type {
  AgentApprovalRequest,
  AgentCapability,
  AgentEvent,
  AgentFailure,
  AgentFailureReason,
  AgentOutputSink,
  AgentProvider,
  AgentReleaseResult,
  AgentResumeRequest,
  AgentSession,
  AgentStartRequest,
  AgentTerminalReason,
  ApprovalAnswer,
  ApprovalAnswerResult,
  CapabilityAttestation,
  CapabilityAttestationResult,
  GuardianReviewObserved,
  ScopedGrantKind,
  ToolObserved,
  WorkerHandle,
} from 'sdk';

const defaultAt = '2026-06-22T10:00:00.000Z';
const defaultExpiry = '2026-06-22T11:00:00.000Z';

const agentFailureReasons: readonly AgentFailureReason[] = [
  'agent-capability-unattested',
  'agent-linkage-lost',
  'approval-relay-unattested',
  'approval-answer-channel-lost',
  'agent-resume-unattested',
  'structured-tool-exit-missing',
  'tool-output-ref-missing',
  'guardian-review-untrusted',
  'host-parentage-unproven',
  'agent-terminal-ambiguous',
];

const allCapabilities: readonly AgentCapability[] = [
  'canRelayApproval',
  'canPersistApprovalAnswerChannel',
  'canResumeOwned',
  'emitsStructuredToolExit',
  'emitsGuardianReview',
  'preservesHostProcessParentage',
];

export type MockAgentCapabilities = Partial<
  Record<AgentCapability, CapabilityAttestationResult | CapabilityAttestation<AgentCapability>>
>;

export interface MockAgentAnswerRule {
  readonly accepts: readonly ScopedGrantKind[];
  readonly persistable: boolean;
  readonly dropAnswer?: boolean;
  readonly mutateResponse?: unknown;
}

export type MockAgentToolObserved = Partial<Omit<ToolObserved, 'source'>> & {
  readonly source?: ToolObserved['source'] | 'host' | 'runner';
  readonly outputBytes?: string;
  readonly stream?: Parameters<AgentOutputSink['putToolOutput']>[0]['stream'];
  readonly contentEncoding?: Parameters<AgentOutputSink['putToolOutput']>[0]['contentEncoding'];
};

export type MockAgentStep =
  | { readonly atMs: number; readonly emit: 'linked'; readonly providerSessionId: string }
  | { readonly atMs: number; readonly emit: 'progress'; readonly message: string; readonly itemId?: string }
  | { readonly atMs: number; readonly emit: 'approval-requested'; readonly request: AgentApprovalRequest }
  | { readonly atMs: number; readonly emit: 'tool-observed'; readonly tool: MockAgentToolObserved }
  | { readonly atMs: number; readonly emit: 'guardian-review'; readonly review: Partial<GuardianReviewObserved> }
  | {
      readonly atMs: number;
      readonly emit: 'terminal';
      readonly reason: AgentTerminalReason;
      readonly exitCode?: number;
    }
  | { readonly atMs: number; readonly emit: 'drop-connection' }
  | {
      readonly atMs: number;
      readonly emit: 'contradiction';
      readonly field: string;
      readonly first: unknown;
      readonly second: unknown;
    };

export interface MockAgentScenario {
  readonly scenarioId: string;
  readonly capabilities: MockAgentCapabilities;
  readonly start: {
    readonly providerSessionId?: string;
    readonly ownershipClass: AgentSession['ownershipClass'];
    readonly providerTurnId?: string;
  };
  readonly events: readonly MockAgentStep[];
  readonly answerRules?: Readonly<Record<string, MockAgentAnswerRule>>;
}

export interface MockAgentProviderOptions {
  readonly at?: string;
  readonly driverVersion?: string;
  readonly platform?: string;
  readonly scenario?: MockAgentScenario;
}

export interface MockAgentProvider extends AgentProvider {
  readonly getSessions: () => readonly AgentSession[];
  readonly getAnsweredApprovals: () => readonly ApprovalAnswer[];
  readonly getFailures: () => readonly AgentFailure[];
}

interface ProviderState {
  readonly sessions: readonly AgentSession[];
  readonly startRequests: Readonly<Record<string, AgentStartRequest>>;
  readonly requests: Readonly<Record<string, AgentApprovalRequest>>;
  readonly answeredApprovals: readonly ApprovalAnswer[];
  readonly failures: readonly AgentFailure[];
  readonly stoppedSessionIds: readonly string[];
  readonly lostSessionIds: readonly string[];
}

export const isAgentFailure = (value: unknown): value is AgentFailure =>
  typeof value === 'object' &&
  value !== null &&
  'reason' in value &&
  agentFailureReasons.includes((value as { readonly reason?: AgentFailureReason }).reason as AgentFailureReason);

const addMs = (iso: string, ms: number): string => new Date(Date.parse(iso) + ms).toISOString();

const clone = <T>(value: T): T => structuredClone(value) as T;

const createFailure = (
  reason: AgentFailureReason,
  overrides: Partial<Omit<AgentFailure, 'reason'>> = {},
): AgentFailure => ({
  reason,
  message: `${reason} occurred`,
  retryable: false,
  evidenceRef: `artifact://testkit/agent/failure/${reason}`,
  ...overrides,
});

const defaultScenario: MockAgentScenario = {
  scenarioId: 'positive-lifecycle',
  capabilities: Object.fromEntries(
    allCapabilities.map((capability) => [capability, 'positive']),
  ) as MockAgentCapabilities,
  start: {
    providerSessionId: 'provider-session-01',
    ownershipClass: 'owned',
    providerTurnId: 'turn-01',
  },
  events: [
    { atMs: 0, emit: 'linked', providerSessionId: 'provider-session-01' },
    { atMs: 1, emit: 'progress', message: 'mock agent started' },
    { atMs: 2, emit: 'terminal', reason: 'completed', exitCode: 0 },
  ],
};

export const mockAgentScenarioFixture = (overrides: Partial<MockAgentScenario> = {}): MockAgentScenario => ({
  scenarioId: overrides.scenarioId ?? defaultScenario.scenarioId,
  capabilities: {
    ...defaultScenario.capabilities,
    ...overrides.capabilities,
  },
  start: {
    ...defaultScenario.start,
    ...overrides.start,
  },
  events: overrides.events ?? defaultScenario.events,
  ...(overrides.answerRules === undefined ? {} : { answerRules: overrides.answerRules }),
});

const createAttestation = (
  capability: AgentCapability,
  result: CapabilityAttestationResult | CapabilityAttestation<AgentCapability>,
  requested: Parameters<AgentProvider['probeCapabilities']>[0],
): CapabilityAttestation<AgentCapability> => {
  if (typeof result !== 'string') {
    return result;
  }

  return {
    capability,
    probeMethod: 'testkit-script',
    result,
    evidenceRef: `artifact://testkit/agent/capability/${capability}`,
    scope: `agent:${requested.driverId}:${requested.protocolSurface}`,
    expiry: defaultExpiry,
    driverVersion: requested.driverVersion,
    platform: requested.platform,
    freshnessKey: requested.freshnessKey,
    at: requested.at,
    details: {
      hostAttestationIds: [...requested.hostAttestationIds],
      scenarioId: 'mock-agent',
    },
  };
};

const createSession = (
  request: AgentStartRequest | AgentResumeRequest,
  providerSessionId: string,
  ownershipClass: AgentSession['ownershipClass'],
  at: string,
  providerTurnId?: string,
): AgentSession => ({
  sessionId: `agent-session-${request.runId}-${request.operationId}`,
  runId: request.runId,
  providerSessionId,
  ...(providerTurnId === undefined ? {} : { providerTurnId }),
  hostWorkerHandleId: request.hostWorker.handleId,
  ownershipClass,
  answerChannels: {},
  startedAt: at,
});

const orderedSteps = (steps: readonly MockAgentStep[]): readonly MockAgentStep[] =>
  steps
    .map((step, index) => ({ index, step }))
    .sort((left, right) => left.step.atMs - right.step.atMs || left.index - right.index)
    .map(({ step }) => step);

const withSessionChannel = (session: AgentSession, request: AgentApprovalRequest): AgentSession => ({
  ...session,
  answerChannels: {
    ...session.answerChannels,
    [request.requestId]: { ...request.answerChannel },
  },
});

const hasPositiveCapability = (scenario: MockAgentScenario, capability: AgentCapability): boolean => {
  const result = scenario.capabilities[capability];

  return typeof result === 'string' ? result === 'positive' : result?.result === 'positive';
};

export const createMockAgentProvider = (options: MockAgentProviderOptions = {}): MockAgentProvider => {
  const at = options.at ?? defaultAt;
  const scenario = options.scenario ?? defaultScenario;
  let state: ProviderState = {
    sessions: [],
    startRequests: {},
    requests: {},
    answeredApprovals: [],
    failures: [],
    stoppedSessionIds: [],
    lostSessionIds: [],
  };

  const recordFailure = (failure: AgentFailure): AgentFailure => {
    state = {
      ...state,
      failures: [...state.failures, failure],
    };

    return failure;
  };

  const startWorker = (request: AgentStartRequest): AgentSession | AgentFailure => {
    if (scenario.start.providerSessionId === undefined || scenario.start.providerSessionId.length === 0) {
      return recordFailure(createFailure('agent-linkage-lost'));
    }

    const session = createSession(
      request,
      scenario.start.providerSessionId,
      scenario.start.ownershipClass,
      at,
      scenario.start.providerTurnId,
    );
    state = {
      ...state,
      sessions: [...state.sessions, session],
      startRequests: {
        ...state.startRequests,
        [session.sessionId]: request,
      },
    };

    return session;
  };

  const isOwnedHostWorker = (worker: WorkerHandle | undefined): boolean =>
    worker !== undefined && worker.ownershipClass === 'owned' && worker.containmentRef.length > 0;

  const requestHasProvenParentage = (request: AgentStartRequest | undefined): boolean =>
    hasPositiveCapability(scenario, 'preservesHostProcessParentage') && isOwnedHostWorker(request?.hostWorker);

  const loseLinkage = (sessionId: string, failure: AgentFailure): AgentFailure => {
    state = {
      ...state,
      lostSessionIds: state.lostSessionIds.includes(sessionId)
        ? state.lostSessionIds
        : [...state.lostSessionIds, sessionId],
    };

    return recordFailure(failure);
  };

  const isLiveOwningSession = (session: AgentSession): boolean =>
    session.ownershipClass !== 'observe-only' &&
    state.sessions.some((candidate) => candidate.sessionId === session.sessionId) &&
    !state.stoppedSessionIds.includes(session.sessionId) &&
    !state.lostSessionIds.includes(session.sessionId);

  const findSessionRequest = (session: AgentSession): AgentStartRequest | undefined =>
    state.startRequests[session.sessionId] ??
    state.sessions
      .filter((candidate) => candidate.providerSessionId === session.providerSessionId)
      .map((candidate) => state.startRequests[candidate.sessionId])
      .find((request) => request !== undefined);

  const isMissingNumber = (value: unknown): boolean => value === undefined || value === null;

  const isMissingText = (value: unknown): boolean => value === undefined || value === null || value === '';

  const normalizeToolEvent = (
    session: AgentSession,
    request: AgentStartRequest | undefined,
    step: Extract<MockAgentStep, { readonly emit: 'tool-observed' }>,
  ): AgentEvent => {
    const tool = step.tool;
    const observedAt = addMs(at, step.atMs);
    if (!requestHasProvenParentage(request)) {
      return {
        type: 'degraded',
        sessionId: session.sessionId,
        failure: recordFailure(createFailure('host-parentage-unproven')),
        at: observedAt,
      };
    }
    if (isMissingNumber(tool.exitCode)) {
      return {
        type: 'degraded',
        sessionId: session.sessionId,
        failure: recordFailure(createFailure('structured-tool-exit-missing')),
        at: observedAt,
      };
    }
    if (tool.source !== undefined && tool.source !== 'agent') {
      return {
        type: 'degraded',
        sessionId: session.sessionId,
        failure: recordFailure(
          createFailure('structured-tool-exit-missing', { message: 'Tool source was not agent.' }),
        ),
        at: observedAt,
      };
    }
    if (isMissingText(tool.outputRef) && isMissingText(tool.outputBytes)) {
      return {
        type: 'degraded',
        sessionId: session.sessionId,
        failure: recordFailure(createFailure('tool-output-ref-missing')),
        at: observedAt,
      };
    }

    const observationId = tool.observationId ?? `tool-${step.atMs}`;
    const sinkResult =
      tool.outputRef === undefined && request !== undefined
        ? request.outputSink.putToolOutput({
            runId: session.runId,
            toolObservationId: observationId,
            stream: tool.stream ?? 'combined',
            bytes: tool.outputBytes ?? '',
            redactionSetId: request.redactionSetId,
            contentEncoding: tool.contentEncoding ?? 'utf8',
          })
        : undefined;

    const outputRef = tool.outputRef ?? sinkResult?.outputRef;
    const outputDigest = tool.outputDigest ?? sinkResult?.digest;
    if (isMissingText(outputRef) || isMissingText(outputDigest) || typeof tool.exitCode !== 'number') {
      return {
        type: 'degraded',
        sessionId: session.sessionId,
        failure: recordFailure(createFailure('tool-output-ref-missing')),
        at: observedAt,
      };
    }

    return {
      type: 'tool-observed',
      sessionId: session.sessionId,
      tool: {
        observationId,
        ...(tool.itemId === undefined ? {} : { itemId: tool.itemId }),
        command: tool.command ?? 'mock-agent-command',
        ...(tool.cwd === undefined ? {} : { cwd: tool.cwd }),
        exitCode: tool.exitCode,
        outputRef: outputRef as string,
        outputDigest: outputDigest as string,
        source: 'agent',
      },
      at: observedAt,
    };
  };

  const observeForSession = async function* observeForSession(session: AgentSession): AsyncIterable<AgentEvent> {
    const startRequest = findSessionRequest(session);
    let linked = false;
    let terminal = false;
    let currentSession = session;

    for (const step of orderedSteps(scenario.events)) {
      await Promise.resolve();
      if (state.stoppedSessionIds.includes(currentSession.sessionId)) {
        return;
      }
      const eventAt = addMs(at, step.atMs);
      const needsLinkage = step.emit !== 'linked' && !linked;
      if (needsLinkage) {
        yield {
          type: 'degraded',
          sessionId: currentSession.sessionId,
          failure: loseLinkage(currentSession.sessionId, createFailure('agent-linkage-lost')),
          at: eventAt,
        };
      }

      if (step.emit === 'linked') {
        if (linked || step.providerSessionId !== currentSession.providerSessionId) {
          yield {
            type: 'degraded',
            sessionId: currentSession.sessionId,
            failure: loseLinkage(currentSession.sessionId, createFailure('agent-linkage-lost')),
            at: eventAt,
          };
          continue;
        }
        linked = true;
        yield { type: 'linked', session: currentSession, at: eventAt };
        continue;
      }

      if (step.emit === 'progress') {
        yield {
          type: 'progress',
          sessionId: currentSession.sessionId,
          message: step.message,
          ...(step.itemId === undefined ? {} : { itemId: step.itemId }),
          at: eventAt,
        };
        continue;
      }

      if (step.emit === 'approval-requested') {
        if (!hasPositiveCapability(scenario, 'canRelayApproval')) {
          yield {
            type: 'degraded',
            sessionId: currentSession.sessionId,
            failure: recordFailure(createFailure('approval-relay-unattested')),
            at: eventAt,
          };
          continue;
        }
        const request = hasPositiveCapability(scenario, 'canPersistApprovalAnswerChannel')
          ? step.request
          : {
              ...step.request,
              answerChannel: {
                ...step.request.answerChannel,
                persistable: false,
              },
            };
        currentSession = withSessionChannel(currentSession, request);
        state = {
          ...state,
          sessions: state.sessions.map((session) =>
            session.sessionId === currentSession.sessionId ? currentSession : session,
          ),
          requests: {
            ...state.requests,
            [request.requestId]: clone(request),
          },
        };
        yield { type: 'approval-requested', sessionId: currentSession.sessionId, request, at: eventAt };
        continue;
      }

      if (step.emit === 'tool-observed') {
        yield normalizeToolEvent(currentSession, startRequest, step);
        continue;
      }

      if (step.emit === 'guardian-review') {
        if (
          !hasPositiveCapability(scenario, 'emitsGuardianReview') ||
          step.review.reviewId === undefined ||
          step.review.actionType === undefined ||
          step.review.status === undefined ||
          step.review.stable !== true ||
          step.review.targetItemId === undefined
        ) {
          yield {
            type: 'degraded',
            sessionId: currentSession.sessionId,
            failure: recordFailure(createFailure('guardian-review-untrusted')),
            at: eventAt,
          };
          continue;
        }
        yield {
          type: 'guardian-review',
          sessionId: currentSession.sessionId,
          review: {
            reviewId: step.review.reviewId,
            targetItemId: step.review.targetItemId,
            actionType: step.review.actionType,
            status: step.review.status,
            ...(step.review.riskLevel === undefined ? {} : { riskLevel: step.review.riskLevel }),
            ...(step.review.rationaleRef === undefined ? {} : { rationaleRef: step.review.rationaleRef }),
            stable: true,
          },
          at: eventAt,
        };
        continue;
      }

      if (step.emit === 'terminal') {
        if (terminal) {
          yield {
            type: 'degraded',
            sessionId: currentSession.sessionId,
            failure: recordFailure(createFailure('agent-terminal-ambiguous')),
            at: eventAt,
          };
          continue;
        }
        terminal = true;
        yield {
          type: 'terminal',
          sessionId: currentSession.sessionId,
          reason: step.reason,
          ...(step.exitCode === undefined ? {} : { exitCode: step.exitCode }),
          at: eventAt,
        };
        continue;
      }

      if (step.emit === 'drop-connection') {
        yield {
          type: 'degraded',
          sessionId: currentSession.sessionId,
          failure: loseLinkage(currentSession.sessionId, createFailure('agent-linkage-lost', { retryable: true })),
          at: eventAt,
        };
        continue;
      }

      yield {
        type: 'degraded',
        sessionId: currentSession.sessionId,
        failure: recordFailure(
          createFailure('agent-terminal-ambiguous', { message: `Contradiction at ${step.field}.` }),
        ),
        at: eventAt,
      };
    }
  };

  const provider: MockAgentProvider = {
    probeCapabilities: (requested) =>
      requested.capabilities.flatMap((capability) => {
        const result = scenario.capabilities[capability];

        return result === undefined ? [] : [createAttestation(capability, result, requested)];
      }),
    startWorker,
    observe: (session) => {
      return (async function* observe(): AsyncIterable<AgentEvent> {
        for await (const event of observeForSession(session)) {
          if (event.type === 'tool-observed') {
            yield event;
            continue;
          }
          yield event;
        }
      })();
    },
    answerApproval: (session, answer): ApprovalAnswerResult => {
      const request = state.requests[answer.requestId];
      const liveSession = state.sessions.find((candidate) => candidate.sessionId === session.sessionId);
      const ownsChannel =
        isLiveOwningSession(session) &&
        liveSession?.answerChannels[answer.requestId] !== undefined &&
        request?.answerChannel.channelRef === liveSession.answerChannels[answer.requestId]?.channelRef;
      const rule = scenario.answerRules?.[answer.requestId] ?? {
        accepts: [request?.proposedGrant?.kind ?? answer.grant.kind],
        persistable: request?.answerChannel.persistable ?? false,
      };
      const accepted = request !== undefined && ownsChannel && rule.accepts.includes(answer.grant.kind);
      const delivered = accepted && rule.dropAnswer !== true;
      const persisted = delivered && rule.persistable && request.answerChannel.persistable;
      if (!delivered) {
        recordFailure(createFailure('approval-answer-channel-lost'));
      }
      if (delivered) {
        state = {
          ...state,
          answeredApprovals: [...state.answeredApprovals, clone(answer)],
        };
      }

      return {
        delivered,
        persisted,
        ...(delivered ? { channelRef: request.answerChannel.channelRef } : {}),
        ...(delivered ? { evidenceRef: request.answerChannel.evidenceRef } : {}),
        at,
      };
    },
    resumeOwned: (request) => {
      if (!hasPositiveCapability(scenario, 'canResumeOwned')) {
        return recordFailure(createFailure('agent-resume-unattested'));
      }
      const previous = state.sessions.find(
        (session) => session.providerSessionId === request.providerSessionId && session.runId === request.runId,
      );
      if (previous === undefined || previous.ownershipClass === 'observe-only') {
        return recordFailure(createFailure('agent-linkage-lost'));
      }

      const resumed = createSession(
        request,
        request.providerSessionId,
        request.ownershipClass,
        at,
        previous.providerTurnId,
      );
      state = {
        ...state,
        sessions: [...state.sessions, resumed],
      };

      return resumed;
    },
    stopObserving: (session): AgentReleaseResult => {
      state = {
        ...state,
        stoppedSessionIds: [...state.stoppedSessionIds, session.sessionId],
      };

      return {
        sessionId: session.sessionId,
        released: true,
        observationStopped: true,
        evidenceRef: `artifact://testkit/agent/${session.sessionId}/release`,
        at,
      };
    },
    getSessions: () => state.sessions.map((session) => clone(session)),
    getAnsweredApprovals: () => state.answeredApprovals.map((answer) => clone(answer)),
    getFailures: () => state.failures.map((failure) => clone(failure)),
  };

  return provider;
};
