import { describe, expect, it } from 'vitest';

import type { AgentResumeRequest, AgentStartRequest, WorkerHandle } from '../../../src/index.js';

import { agentResumeRequestFixture, agentStartRequestFixture, workerHandleFixture } from './fixtures/shared.js';

describe('prov-01 agent host worker boundary', () => {
  it('uses the SDK Execution Host WorkerHandle in start and resume requests', () => {
    const hostWorker: WorkerHandle = workerHandleFixture({
      handleId: 'worker-handle-from-host',
      ownershipClass: 'owned-remote',
    });
    const startRequest: AgentStartRequest = agentStartRequestFixture({ hostWorker });
    const resumeRequest: AgentResumeRequest = agentResumeRequestFixture({
      hostWorker,
      ownershipClass: 'owned-remote',
    });

    expect(startRequest.hostWorker).toBe(hostWorker);
    expect(resumeRequest.hostWorker).toBe(hostWorker);
    expect(startRequest.hostWorker.workspaceHandleId).toBe('workspace-handle-01');
    expect(resumeRequest.hostWorker.ownershipClass).toBe('owned-remote');
  });
});
