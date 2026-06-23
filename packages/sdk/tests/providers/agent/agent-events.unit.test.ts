import { describe, expect, it } from 'vitest';

import type { AgentEvent } from '../../../src/index.js';

import {
  agentApprovalRequestFixture,
  agentFailureFixture,
  agentSessionFixture,
  guardianReviewObservedFixture,
  toolObservedFixture,
} from './fixtures/shared.js';

describe('prov-01 agent normalized events', () => {
  it('supports every normalized event kind as a discriminated union', () => {
    const events = [
      { type: 'linked', session: agentSessionFixture(), at: '2026-06-22T10:12:00.000Z' },
      {
        type: 'progress',
        sessionId: 'agent-session-01',
        message: 'working',
        itemId: 'item-01',
        at: '2026-06-22T10:12:01.000Z',
      },
      {
        type: 'approval-requested',
        sessionId: 'agent-session-01',
        request: agentApprovalRequestFixture(),
        at: '2026-06-22T10:12:02.000Z',
      },
      {
        type: 'tool-observed',
        sessionId: 'agent-session-01',
        tool: toolObservedFixture(),
        at: '2026-06-22T10:12:03.000Z',
      },
      {
        type: 'guardian-review',
        sessionId: 'agent-session-01',
        review: guardianReviewObservedFixture(),
        at: '2026-06-22T10:12:04.000Z',
      },
      {
        type: 'degraded',
        sessionId: 'agent-session-01',
        failure: agentFailureFixture('approval-relay-unattested'),
        at: '2026-06-22T10:12:05.000Z',
      },
      {
        type: 'terminal',
        sessionId: 'agent-session-01',
        reason: 'completed',
        exitCode: 0,
        at: '2026-06-22T10:12:06.000Z',
      },
    ] satisfies readonly AgentEvent[];

    expect(events.map((event) => event.type)).toEqual([
      'linked',
      'progress',
      'approval-requested',
      'tool-observed',
      'guardian-review',
      'degraded',
      'terminal',
    ]);
  });
});
