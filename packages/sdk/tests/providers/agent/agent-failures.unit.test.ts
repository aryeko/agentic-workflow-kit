import { describe, expect, it } from 'vitest';

import type { AgentEvent, AgentFailureReason } from '../../../src/index.js';

import { agentCapabilityUnattestedFixture } from './fixtures/agent-capability-unattested.fixture.js';
import { agentLinkageLostFixture } from './fixtures/agent-linkage-lost.fixture.js';
import { agentResumeUnattestedFixture } from './fixtures/agent-resume-unattested.fixture.js';
import { agentTerminalAmbiguousFixture } from './fixtures/agent-terminal-ambiguous.fixture.js';
import { approvalAnswerChannelLostFixture } from './fixtures/approval-answer-channel-lost.fixture.js';
import { approvalRelayUnattestedFixture } from './fixtures/approval-relay-unattested.fixture.js';
import { guardianReviewUntrustedFixture } from './fixtures/guardian-review-untrusted.fixture.js';
import { hostParentageUnprovenFixture } from './fixtures/host-parentage-unproven.fixture.js';
import { structuredToolExitMissingFixture } from './fixtures/structured-tool-exit-missing.fixture.js';
import { toolOutputRefMissingFixture } from './fixtures/tool-output-ref-missing.fixture.js';

describe('prov-01 agent failure tokens', () => {
  it('constructs one named negative fixture per contracted failure reason', () => {
    const fixtures = [
      agentCapabilityUnattestedFixture,
      agentLinkageLostFixture,
      approvalRelayUnattestedFixture,
      approvalAnswerChannelLostFixture,
      agentResumeUnattestedFixture,
      structuredToolExitMissingFixture,
      toolOutputRefMissingFixture,
      guardianReviewUntrustedFixture,
      hostParentageUnprovenFixture,
      agentTerminalAmbiguousFixture,
    ];
    const reasons = fixtures.map((fixture) => fixture.reason) satisfies readonly AgentFailureReason[];

    expect(reasons).toEqual([
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
    ]);
    expect(fixtures.every((fixture) => fixture.evidenceRef?.includes(fixture.reason))).toBe(true);
  });

  it('carries failure reasons through degraded agent events', () => {
    const degradedEvent = {
      type: 'degraded',
      sessionId: 'agent-session-01',
      failure: approvalRelayUnattestedFixture,
      at: '2026-06-22T10:12:05.000Z',
    } satisfies AgentEvent;

    expect(degradedEvent.failure.reason).toBe('approval-relay-unattested');
  });
});
