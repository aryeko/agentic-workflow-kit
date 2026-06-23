import type { WorkerHandle } from '../execution-host/index.js';

import type { ApprovalAnswerChannel } from './approvals.js';
import type { AgentOutputSink } from './output.js';

export type AgentOwnershipClass = WorkerHandle['ownershipClass'];

export interface AgentStartRequest {
  readonly runId: string;
  readonly taskId: string;
  readonly operationId: string;
  readonly hostWorker: WorkerHandle;
  readonly prompt: string;
  readonly approvalMode: 'manual' | 'assisted';
  readonly outputSink: AgentOutputSink;
  readonly redactionSetId: string;
}

export interface AgentSession {
  readonly sessionId: string;
  readonly runId: string;
  readonly providerSessionId: string;
  readonly providerTurnId?: string;
  readonly hostWorkerHandleId: string;
  readonly ownershipClass: AgentOwnershipClass;
  readonly answerChannels: Readonly<Record<string, ApprovalAnswerChannel>>;
  readonly startedAt: string;
}

export interface AgentResumeRequest {
  readonly providerSessionId: string;
  readonly runId: string;
  readonly operationId: string;
  readonly ownershipClass: Exclude<AgentOwnershipClass, 'observe-only'>;
  readonly hostWorker: WorkerHandle;
}

export interface AgentReleaseResult {
  readonly sessionId: string;
  readonly released: boolean;
  readonly observationStopped: boolean;
  readonly evidenceRef?: string;
  readonly at: string;
}
