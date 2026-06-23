import type {
  AgentApprovalRequest,
  AgentCapability,
  AgentEvent,
  AgentFailure,
  AgentFailureReason,
  AgentOutputSink,
  AgentProbeScope,
  AgentProvider,
  AgentReleaseResult,
  AgentResumeRequest,
  AgentSession,
  AgentStartRequest,
  AgentTerminalReason,
  ApprovalAnswer,
  ApprovalAnswerChannel,
  ApprovalAnswerResult,
  ApprovalKind,
  CapabilityAttestation,
  GuardianReviewObserved,
  ScopedGrant,
  ScopedGrantKind,
  ToolObserved,
  WorkerHandle,
} from 'sdk';

import {
  agentApprovalRequestFixture,
  agentEventFixture,
  agentFailureFixture,
  agentOutputSinkFixture,
  agentProbeScopeFixture,
  agentProviderFixture,
  agentReleaseResultFixture,
  agentResumeRequestFixture,
  agentSessionFixture,
  agentStartRequestFixture,
  approvalAnswerChannelFixture,
  approvalAnswerFixture,
  approvalAnswerResultFixture,
  capabilityAttestationFixture,
  guardianReviewObservedFixture,
  scopedGrantFixture,
  toolObservedFixture,
  workerHandleFixture,
} from './fixtures/shared.js';

const provider = agentProviderFixture() satisfies AgentProvider;
const capability: AgentCapability = 'canRelayApproval';
const terminal: AgentTerminalReason = 'approval-parked';
const approvalKind: ApprovalKind = 'command-execution';
const grantKind: ScopedGrantKind = 'deny-park';
const failureReason: AgentFailureReason = 'approval-answer-channel-lost';
const worker = workerHandleFixture() satisfies WorkerHandle;
const probe = agentProbeScopeFixture() satisfies AgentProbeScope;
const sink = agentOutputSinkFixture() satisfies AgentOutputSink;
const session = agentSessionFixture() satisfies AgentSession;
const start = agentStartRequestFixture() satisfies AgentStartRequest;
const channel = approvalAnswerChannelFixture() satisfies ApprovalAnswerChannel;
const grant = scopedGrantFixture() satisfies ScopedGrant;
const answer = approvalAnswerFixture() satisfies ApprovalAnswer;
const approvalRequest = agentApprovalRequestFixture() satisfies AgentApprovalRequest;
const tool = toolObservedFixture() satisfies ToolObserved;
const review = guardianReviewObservedFixture() satisfies GuardianReviewObserved;
const failure = agentFailureFixture('approval-answer-channel-lost') satisfies AgentFailure;
const resume = agentResumeRequestFixture() satisfies AgentResumeRequest;
const result = approvalAnswerResultFixture() satisfies ApprovalAnswerResult;
const release = agentReleaseResultFixture() satisfies AgentReleaseResult;
const event = agentEventFixture() satisfies AgentEvent;
const attestation = capabilityAttestationFixture() satisfies CapabilityAttestation<'canRelayApproval'>;

void provider;
void capability;
void terminal;
void approvalKind;
void grantKind;
void failureReason;
void worker;
void probe;
void sink;
void session;
void start;
void channel;
void grant;
void answer;
void approvalRequest;
void tool;
void review;
void failure;
void resume;
void result;
void release;
void event;
void attestation;
