import type { ApprovalContext } from '../../../../src/core/approval/contracts/index.js';

const invalidContext: ApprovalContext = {
  runId: 'run-01',
  taskId: 'task-01',
  operationId: 'op-01',
  sessionId: 'session-01',
  policyRef: 'policy:approval',
  agentRequestEventId: 'evt-agent-request-01',
  promptRef: 'artifact://prompt-01',
};

void invalidContext;
