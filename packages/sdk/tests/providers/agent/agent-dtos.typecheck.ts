import type {
  AgentFailure,
  AgentProbeScope,
  AgentReleaseResult,
  AgentResumeRequest,
  AgentSession,
  ApprovalAnswer,
  ApprovalAnswerChannel,
  ApprovalAnswerResult,
  GuardianReviewObserved,
  ScopedGrant,
  ToolObserved,
  WorkerHandle,
} from '../../../src/index.js';

import {
  agentFailureFixture,
  agentProbeScopeFixture,
  agentReleaseResultFixture,
  agentResumeRequestFixture,
  agentSessionFixture,
  approvalAnswerChannelFixture,
  approvalAnswerFixture,
  approvalAnswerResultFixture,
  guardianReviewObservedFixture,
  scopedGrantFixture,
  toolObservedFixture,
  workerHandleFixture,
} from './fixtures/shared.js';

const probeScope = agentProbeScopeFixture() satisfies AgentProbeScope;
const workerHandle = workerHandleFixture() satisfies WorkerHandle;
const session = agentSessionFixture() satisfies AgentSession;
const answerChannel = approvalAnswerChannelFixture() satisfies ApprovalAnswerChannel;
const grant = scopedGrantFixture() satisfies ScopedGrant;
const answer = approvalAnswerFixture() satisfies ApprovalAnswer;
const tool = toolObservedFixture() satisfies ToolObserved;
const review = guardianReviewObservedFixture() satisfies GuardianReviewObserved;
const failure = agentFailureFixture('approval-answer-channel-lost') satisfies AgentFailure;
const resume = agentResumeRequestFixture() satisfies AgentResumeRequest;
const answerResult = approvalAnswerResultFixture() satisfies ApprovalAnswerResult;
const release = agentReleaseResultFixture() satisfies AgentReleaseResult;

void probeScope;
void workerHandle;
void session;
void answerChannel;
void grant;
void answer;
void tool;
void review;
void failure;
void resume;
void answerResult;
void release;

// @ts-expect-error AC-prov-01 AgentProbeScope requires hostAttestationIds.
const probeScopeMissingHostAttestations: AgentProbeScope = {
  driverId: 'provider-codex',
  driverVersion: '0.141.0',
  platform: 'darwin-arm64',
  protocolSurface: 'codex-app-server',
  freshnessKey: 'provider-codex:0.141.0:darwin-arm64',
  capabilities: ['canRelayApproval'],
  evidenceRequired: 'live-smoke',
  at: '2026-06-22T10:10:00.000Z',
};

// @ts-expect-error AC-prov-01 AgentSession requires hostWorkerHandleId.
const sessionMissingHostWorker: AgentSession = {
  sessionId: 'agent-session-01',
  runId: 'run-01',
  providerSessionId: 'provider-session-01',
  ownershipClass: 'owned',
  answerChannels: {},
  startedAt: '2026-06-22T10:12:00.000Z',
};

// @ts-expect-error AC-prov-01 ApprovalAnswerChannel requires persistable.
const channelMissingPersistable: ApprovalAnswerChannel = {
  channelRef: 'approval-channel-01',
  providerRequestId: 'provider-request-01',
  evidenceRef: 'artifact://approval-channel',
};

// @ts-expect-error AC-prov-01 ScopedGrant requires grantEventId.
const grantMissingEvent: ScopedGrant = {
  grantId: 'grant-01',
  kind: 'command-once',
  scope: 'request',
};

// @ts-expect-error AC-prov-01 ApprovalAnswer requires decisionEventId.
const answerMissingDecision: ApprovalAnswer = {
  requestId: 'approval-request-01',
  grant,
};

// @ts-expect-error AC-prov-01 ToolObserved requires numeric exitCode.
const toolMissingExitCode: ToolObserved = {
  observationId: 'tool-observation-01',
  command: 'pnpm test',
  outputRef: 'artifact://tool-output',
  outputDigest: 'tool-output-digest-01',
  source: 'agent',
};

// @ts-expect-error AC-prov-01 GuardianReviewObserved requires stable.
const guardianReviewMissingStable: GuardianReviewObserved = {
  reviewId: 'guardian-review-01',
  actionType: 'command-execution',
  status: 'approved',
};

// @ts-expect-error AC-prov-01 AgentFailure requires retryable.
const failureMissingRetryable: AgentFailure = {
  reason: 'agent-linkage-lost',
  message: 'missing linkage',
};

const resumeObserveOnly: AgentResumeRequest = {
  providerSessionId: 'provider-session-01',
  runId: 'run-01',
  operationId: 'op-01',
  // @ts-expect-error AC-prov-01 AgentResumeRequest cannot resume observe-only sessions.
  ownershipClass: 'observe-only',
  hostWorker: workerHandle,
};

// @ts-expect-error AC-prov-01 ApprovalAnswerResult requires delivered.
const answerResultMissingDelivered: ApprovalAnswerResult = {
  persisted: false,
  at: '2026-06-22T10:13:00.000Z',
};

// @ts-expect-error AC-prov-01 AgentReleaseResult requires observationStopped.
const releaseMissingObservationStopped: AgentReleaseResult = {
  sessionId: 'agent-session-01',
  released: true,
  at: '2026-06-22T10:14:00.000Z',
};

void probeScopeMissingHostAttestations;
void sessionMissingHostWorker;
void channelMissingPersistable;
void grantMissingEvent;
void answerMissingDecision;
void toolMissingExitCode;
void guardianReviewMissingStable;
void failureMissingRetryable;
void resumeObserveOnly;
void answerResultMissingDelivered;
void releaseMissingObservationStopped;
