import { describe, expect, it } from 'vitest';

import {
  agentProviderFixture,
  agentSessionFixture,
  approvalAnswerFixture,
  approvalAnswerResultFixture,
} from './fixtures/shared.js';

describe('prov-01 approval answer channel semantics', () => {
  it('returns delivered and persisted only when the provider channel accepted a durable answer', () => {
    const session = agentSessionFixture();
    const provider = agentProviderFixture();

    const result = provider.answerApproval(session, approvalAnswerFixture());

    expect(result).toMatchObject({
      delivered: true,
      persisted: true,
      channelRef: 'approval-channel-01',
      evidenceRef: 'artifact://approval-answer',
    });
  });

  it('represents a lost answer channel as not delivered and not persisted', () => {
    const result = approvalAnswerResultFixture({
      delivered: false,
      persisted: false,
      channelRef: undefined,
      evidenceRef: undefined,
    });

    expect(result.delivered).toBe(false);
    expect(result.persisted).toBe(false);
    expect(result.channelRef).toBeUndefined();
    expect(result.evidenceRef).toBeUndefined();
  });
});
