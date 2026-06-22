import { describe, expect, it } from 'vitest';

import {
  agentApprovalRequestFixture,
  agentEventFixture,
  agentFailureFixture,
  agentProbeScopeFixture,
  agentReleaseResultFixture,
  agentResumeRequestFixture,
  agentSessionFixture,
  agentStartRequestFixture,
  approvalAnswerChannelFixture,
  approvalAnswerFixture,
  approvalAnswerResultFixture,
  guardianReviewObservedFixture,
  scopedGrantFixture,
  toolObservedFixture,
  workerHandleFixture,
} from './fixtures/shared.js';

describe('prov-01 agent DTO catalog', () => {
  it('constructs provider DTOs with the required fields', () => {
    const worker = workerHandleFixture();
    const start = agentStartRequestFixture({ hostWorker: worker });
    const probe = agentProbeScopeFixture();
    const channel = approvalAnswerChannelFixture();
    const session = agentSessionFixture({ hostWorkerHandleId: worker.handleId });
    const grant = scopedGrantFixture();
    const answer = approvalAnswerFixture({ grant });
    const request = agentApprovalRequestFixture({ answerChannel: channel, proposedGrant: grant });
    const tool = toolObservedFixture();
    const review = guardianReviewObservedFixture();
    const failure = agentFailureFixture('structured-tool-exit-missing');
    const resume = agentResumeRequestFixture({ hostWorker: worker });
    const result = approvalAnswerResultFixture();
    const release = agentReleaseResultFixture({ sessionId: session.sessionId });
    const event = agentEventFixture({ sessionId: session.sessionId, tool });

    expect(start.hostWorker.handleId).toBe(worker.handleId);
    expect(probe.hostAttestationIds).toEqual(['host-att-01']);
    expect(session.answerChannels['approval-request-01']).toEqual(channel);
    expect(answer.grant.grantEventId).toBe(grant.grantEventId);
    expect(request.answerChannel.persistable).toBe(true);
    expect(tool.exitCode).toBe(0);
    expect(review.stable).toBe(true);
    expect(failure.reason).toBe('structured-tool-exit-missing');
    expect(resume.ownershipClass).toBe('owned');
    expect(result.delivered).toBe(true);
    expect(release.observationStopped).toBe(true);
    expect(event.type).toBe('tool-observed');
  });

  it('captures tool output by reference through the supplied output sink', () => {
    const start = agentStartRequestFixture();

    const stored = start.outputSink.putToolOutput({
      runId: start.runId,
      toolObservationId: 'tool-observation-01',
      stream: 'combined',
      bytes: 'redacted output',
      redactionSetId: start.redactionSetId,
      contentEncoding: 'utf8',
    });

    expect(stored).toEqual({
      outputRef: 'artifact://run-01/tool-observation-01/combined',
      digest: 'tool-output-digest-01',
      redactionApplied: true,
    });
  });
});
