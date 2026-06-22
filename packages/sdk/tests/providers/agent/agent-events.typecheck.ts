import type { AgentEvent } from '../../../src/index.js';

import {
  agentApprovalRequestFixture,
  agentFailureFixture,
  agentSessionFixture,
  guardianReviewObservedFixture,
  toolObservedFixture,
} from './fixtures/shared.js';

const assertNever = (_value: never): never => {
  throw new Error('unreachable');
};

const describeEvent = (event: AgentEvent): string => {
  switch (event.type) {
    case 'linked':
      return event.session.providerSessionId;
    case 'progress':
      return event.message ?? event.itemId ?? event.sessionId;
    case 'approval-requested':
      return event.request.answerChannel.channelRef;
    case 'tool-observed':
      return String(event.tool.exitCode);
    case 'guardian-review':
      return event.review.status;
    case 'degraded':
      return event.failure.reason;
    case 'terminal':
      return event.reason;
    default:
      return assertNever(event);
  }
};

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
    failure: agentFailureFixture('tool-output-ref-missing'),
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

void describeEvent;
void events;

// @ts-expect-error AC-prov-01 tool-observed requires tool payload.
const toolObservedMissingTool: AgentEvent = {
  type: 'tool-observed',
  sessionId: 'agent-session-01',
  at: '2026-06-22T10:12:03.000Z',
};

void toolObservedMissingTool;
