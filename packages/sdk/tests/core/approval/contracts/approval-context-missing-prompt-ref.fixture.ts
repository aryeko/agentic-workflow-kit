import type { ApprovalContext } from '../../../../src/core/approval/contracts/index.js';

// @ts-expect-error ApprovalContext requires promptRef.
const invalidContext: ApprovalContext = {
  runId: 'run-01',
  taskId: 'task-01',
  operationId: 'op-01',
  sessionId: 'session-01',
  policyRef: 'policy:approval',
  agentRequestEventId: 'evt-agent-request-01',
  requestedAt: '2026-06-26T09:00:00.000Z',
};

void invalidContext;
