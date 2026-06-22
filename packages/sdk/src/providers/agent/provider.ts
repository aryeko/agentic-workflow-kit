import type { CapabilityAttestation } from '../attestation/index.js';

import type { ApprovalAnswer, ApprovalAnswerResult } from './approvals.js';
import type { AgentCapability, AgentFailure, AgentProbeScope } from './capabilities.js';
import type { AgentEvent } from './events.js';
import type { AgentReleaseResult, AgentResumeRequest, AgentSession, AgentStartRequest } from './session.js';

export interface AgentProvider {
  probeCapabilities(scope: AgentProbeScope): CapabilityAttestation<AgentCapability>[];
  startWorker(request: AgentStartRequest): AgentSession | AgentFailure;
  observe(session: AgentSession): AsyncIterable<AgentEvent>;
  answerApproval(session: AgentSession, answer: ApprovalAnswer): ApprovalAnswerResult;
  resumeOwned(request: AgentResumeRequest): AgentSession | AgentFailure;
  stopObserving(session: AgentSession): AgentReleaseResult;
}
