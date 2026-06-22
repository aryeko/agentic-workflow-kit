import type {
  AgentApprovalRequest,
  AgentEvent,
  AgentFailure,
  AgentFailureReason,
  AgentOutputSink,
  AgentProbeScope,
  AgentProvider,
  AgentReleaseResult,
  AgentResumeRequest,
  AgentSession,
  ApprovalAnswer,
  ApprovalAnswerChannel,
  ApprovalAnswerResult,
  CapabilityAttestation,
  GuardianReviewObserved,
  ScopedGrant,
  ToolObserved,
  WorkerHandle,
} from '../../../../src/index.js';

export const workerHandleFixture = (overrides: Partial<WorkerHandle> = {}): WorkerHandle => ({
  handleId: 'worker-handle-01',
  runId: 'run-01',
  operationId: 'op-01',
  workspaceHandleId: 'workspace-handle-01',
  ownershipClass: 'owned',
  containmentRef: 'containment://worker-handle-01',
  startedAt: '2026-06-22T10:01:00.000Z',
  ...overrides,
});

export const agentProbeScopeFixture = (overrides: Partial<AgentProbeScope> = {}): AgentProbeScope => ({
  driverId: 'provider-codex',
  driverVersion: '0.141.0',
  platform: 'darwin-arm64',
  protocolSurface: 'codex-app-server',
  freshnessKey: 'provider-codex:0.141.0:darwin-arm64',
  capabilities: ['canRelayApproval', 'canPersistApprovalAnswerChannel', 'emitsStructuredToolExit'],
  hostAttestationIds: ['host-att-01'],
  evidenceRequired: 'live-smoke',
  at: '2026-06-22T10:10:00.000Z',
  ...overrides,
});

export const agentOutputSinkFixture = (overrides: Partial<AgentOutputSink> = {}): AgentOutputSink => ({
  putToolOutput: (input) => ({
    outputRef: `artifact://${input.runId}/${input.toolObservationId}/${input.stream}`,
    digest: 'tool-output-digest-01',
    redactionApplied: true,
  }),
  ...overrides,
});

export const agentStartRequestFixture = (
  overrides: Partial<Parameters<AgentProvider['startWorker']>[0]> = {},
): Parameters<AgentProvider['startWorker']>[0] => ({
  runId: 'run-01',
  taskId: 'task-01',
  operationId: 'op-01',
  hostWorker: workerHandleFixture(),
  prompt: 'Implement prov-01 only.',
  approvalMode: 'manual',
  outputSink: agentOutputSinkFixture(),
  redactionSetId: 'redaction-set-01',
  ...overrides,
});

export const approvalAnswerChannelFixture = (
  overrides: Partial<ApprovalAnswerChannel> = {},
): ApprovalAnswerChannel => ({
  channelRef: 'approval-channel-01',
  providerRequestId: 'provider-request-01',
  providerApprovalId: 'provider-approval-01',
  threadId: 'thread-01',
  turnId: 'turn-01',
  expiresAt: '2026-06-22T11:00:00.000Z',
  persistable: true,
  evidenceRef: 'artifact://approval-channel',
  ...overrides,
});

export const agentSessionFixture = (overrides: Partial<AgentSession> = {}): AgentSession => ({
  sessionId: 'agent-session-01',
  runId: 'run-01',
  providerSessionId: 'provider-session-01',
  providerTurnId: 'turn-01',
  hostWorkerHandleId: 'worker-handle-01',
  ownershipClass: 'owned',
  answerChannels: {
    'approval-request-01': approvalAnswerChannelFixture(),
  },
  startedAt: '2026-06-22T10:12:00.000Z',
  ...overrides,
});

export const scopedGrantFixture = (overrides: Partial<ScopedGrant> = {}): ScopedGrant => ({
  grantId: 'grant-01',
  kind: 'command-once',
  scope: 'request',
  command: 'pnpm test',
  commandPrefix: ['pnpm'],
  filePaths: ['packages/sdk/src/providers/agent/index.ts'],
  grantEventId: 'event-approval-decision-01',
  ...overrides,
});

export const approvalAnswerFixture = (overrides: Partial<ApprovalAnswer> = {}): ApprovalAnswer => ({
  requestId: 'approval-request-01',
  decisionEventId: 'event-approval-decision-01',
  grant: scopedGrantFixture(),
  ...overrides,
});

export const agentApprovalRequestFixture = (overrides: Partial<AgentApprovalRequest> = {}): AgentApprovalRequest => ({
  requestId: 'approval-request-01',
  kind: 'command-execution',
  providerMethod: 'turn/interrupt',
  prompt: 'Allow command execution?',
  command: 'pnpm test',
  cwd: '/tmp/worktrees/run-01',
  proposedGrant: scopedGrantFixture(),
  answerChannel: approvalAnswerChannelFixture(),
  ...overrides,
});

export const toolObservedFixture = (overrides: Partial<ToolObserved> = {}): ToolObserved => ({
  observationId: 'tool-observation-01',
  itemId: 'item-01',
  command: 'pnpm test',
  cwd: '/tmp/worktrees/run-01',
  exitCode: 0,
  outputRef: 'artifact://tool-output',
  outputDigest: 'tool-output-digest-01',
  source: 'agent',
  ...overrides,
});

export const guardianReviewObservedFixture = (
  overrides: Partial<GuardianReviewObserved> = {},
): GuardianReviewObserved => ({
  reviewId: 'guardian-review-01',
  targetItemId: 'item-01',
  actionType: 'command-execution',
  status: 'approved',
  riskLevel: 'low',
  rationaleRef: 'artifact://guardian-rationale',
  stable: true,
  ...overrides,
});

export const agentFailureFixture = (
  reason: AgentFailureReason,
  overrides: Partial<AgentFailure> = {},
): AgentFailure => ({
  reason,
  message: `${reason} occurred`,
  retryable: false,
  evidenceRef: `artifact://${reason}`,
  ...overrides,
});

export const agentResumeRequestFixture = (overrides: Partial<AgentResumeRequest> = {}): AgentResumeRequest => ({
  providerSessionId: 'provider-session-01',
  runId: 'run-01',
  operationId: 'op-01',
  ownershipClass: 'owned',
  hostWorker: workerHandleFixture(),
  ...overrides,
});

export const approvalAnswerResultFixture = (overrides: Partial<ApprovalAnswerResult> = {}): ApprovalAnswerResult => ({
  delivered: true,
  persisted: true,
  channelRef: 'approval-channel-01',
  evidenceRef: 'artifact://approval-answer',
  at: '2026-06-22T10:13:00.000Z',
  ...overrides,
});

export const agentReleaseResultFixture = (overrides: Partial<AgentReleaseResult> = {}): AgentReleaseResult => ({
  sessionId: 'agent-session-01',
  released: true,
  observationStopped: true,
  evidenceRef: 'artifact://agent-release',
  at: '2026-06-22T10:14:00.000Z',
  ...overrides,
});

export const agentEventFixture = (
  overrides: Partial<Extract<AgentEvent, { type: 'tool-observed' }>> = {},
): Extract<AgentEvent, { type: 'tool-observed' }> => ({
  type: 'tool-observed',
  sessionId: 'agent-session-01',
  tool: toolObservedFixture(),
  at: '2026-06-22T10:15:00.000Z',
  ...overrides,
});

export const capabilityAttestationFixture = (
  overrides: Partial<CapabilityAttestation<'canRelayApproval'>> = {},
): CapabilityAttestation<'canRelayApproval'> => ({
  capability: 'canRelayApproval',
  probeMethod: 'live-smoke',
  result: 'positive',
  evidenceRef: 'artifact://agent-attestation',
  scope: 'agent',
  expiry: '2026-06-22T11:10:00.000Z',
  driverVersion: '0.141.0',
  platform: 'darwin-arm64',
  freshnessKey: 'provider-codex:0.141.0:darwin-arm64',
  at: '2026-06-22T10:10:00.000Z',
  details: {
    protocolSurface: 'codex-app-server',
    hostAttestationIds: ['host-att-01'],
  },
  ...overrides,
});

async function* observeFixture(session: AgentSession): AsyncIterable<AgentEvent> {
  yield {
    type: 'linked',
    session,
    at: '2026-06-22T10:12:00.000Z',
  };
}

export const agentProviderFixture = (overrides: Partial<AgentProvider> = {}): AgentProvider => ({
  probeCapabilities: () => [capabilityAttestationFixture()],
  startWorker: (request) =>
    agentSessionFixture({
      runId: request.runId,
      hostWorkerHandleId: request.hostWorker.handleId,
      ownershipClass: request.hostWorker.ownershipClass,
    }),
  observe: (session) => observeFixture(session),
  answerApproval: (session, answer) =>
    approvalAnswerResultFixture({
      channelRef: session.answerChannels[answer.requestId]?.channelRef,
    }),
  resumeOwned: (request) =>
    agentSessionFixture({
      runId: request.runId,
      providerSessionId: request.providerSessionId,
      hostWorkerHandleId: request.hostWorker.handleId,
      ownershipClass: request.ownershipClass,
    }),
  stopObserving: (session) => agentReleaseResultFixture({ sessionId: session.sessionId }),
  ...overrides,
});
