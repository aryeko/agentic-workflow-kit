import { describe, expect, it } from 'vitest';

import { isCapabilityAttestation } from 'sdk';
import type {
  AgentProvider,
  AgentSession,
  AgentStartRequest,
  ApprovalAnswerResult,
  CapabilityAttestation,
  WorkerHandle,
} from 'sdk';

import {
  agentProviderFixture,
  agentSessionFixture,
  agentStartRequestFixture,
  approvalAnswerFixture,
  capabilityAttestationFixture,
  workerHandleFixture,
} from './fixtures/shared.js';

describe('prov-01 public sdk agent imports', () => {
  it('imports the agent provider surface from the sdk entrypoint', () => {
    const provider: AgentProvider = agentProviderFixture();
    const worker: WorkerHandle = workerHandleFixture();
    const start: AgentStartRequest = agentStartRequestFixture({ hostWorker: worker });
    const session: AgentSession = agentSessionFixture({ hostWorkerHandleId: worker.handleId });
    const answer: ApprovalAnswerResult = provider.answerApproval(session, approvalAnswerFixture());
    const attestation: CapabilityAttestation<'canRelayApproval'> = capabilityAttestationFixture();

    expect(answer.delivered).toBe(true);
    expect(start.hostWorker.handleId).toBe(worker.handleId);
    expect(session.hostWorkerHandleId).toBe(worker.handleId);
    expect(isCapabilityAttestation(attestation)).toBe(true);
  });
});
