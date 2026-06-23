import type { AgentResumeRequest, AgentStartRequest, WorkerHandle } from '../../../src/index.js';

import { agentOutputSinkFixture, workerHandleFixture } from './fixtures/shared.js';

const hostWorker = workerHandleFixture() satisfies WorkerHandle;

const startWithHostWorker = {
  runId: 'run-01',
  taskId: 'task-01',
  operationId: 'op-01',
  hostWorker,
  prompt: 'Implement the task.',
  approvalMode: 'manual',
  outputSink: agentOutputSinkFixture(),
  redactionSetId: 'redaction-set-01',
} satisfies AgentStartRequest;

const resumeWithHostWorker = {
  providerSessionId: 'provider-session-01',
  runId: 'run-01',
  operationId: 'op-01',
  ownershipClass: 'owned',
  hostWorker,
} satisfies AgentResumeRequest;

const startWithNonWorker = {
  runId: 'run-01',
  taskId: 'task-01',
  operationId: 'op-01',
  // @ts-expect-error AC-prov-01 hostWorker must be the Execution Host WorkerHandle shape.
  hostWorker: { handleId: 'worker-handle-01' },
  prompt: 'Implement the task.',
  approvalMode: 'manual',
  outputSink: agentOutputSinkFixture(),
  redactionSetId: 'redaction-set-01',
} satisfies AgentStartRequest;

const resumeWithNonWorker = {
  providerSessionId: 'provider-session-01',
  runId: 'run-01',
  operationId: 'op-01',
  ownershipClass: 'owned',
  // @ts-expect-error AC-prov-01 hostWorker must be the Execution Host WorkerHandle shape.
  hostWorker: { handleId: 'worker-handle-01' },
} satisfies AgentResumeRequest;

void startWithHostWorker;
void resumeWithHostWorker;
void startWithNonWorker;
void resumeWithNonWorker;
