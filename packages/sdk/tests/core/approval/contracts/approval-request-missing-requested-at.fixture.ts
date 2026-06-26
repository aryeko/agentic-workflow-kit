import type { ApprovalRequest } from '../../../../src/core/approval/contracts/index.js';

const invalidRequest: ApprovalRequest = {
  schema: 'kit-vnext.approval-request.v1',
  requestId: 'request-01',
  runId: 'run-01',
  taskId: 'task-01',
  sessionId: 'session-01',
  operationId: 'op-01',
  subject: 'command',
  promptRef: 'artifact://prompt-01',
  answerChannelRef: 'channel-01',
  answerChannelPersistable: true,
  policyRef: 'policy:approval',
  agentRequestEventId: 'evt-agent-request-01',
};

void invalidRequest;
