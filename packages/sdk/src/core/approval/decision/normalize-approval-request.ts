import type { AgentApprovalRequest } from '../../../providers/agent/index.js';

import type { ApprovalContext, ApprovalRequest } from '../contracts/index.js';

import { requestedScopeFromRequest, subjectFromRequest } from './shared.js';

export const normalizeApprovalRequest = (input: AgentApprovalRequest, context: ApprovalContext): ApprovalRequest => ({
  schema: 'kit-vnext.approval-request.v1',
  requestId: input.requestId,
  runId: context.runId,
  taskId: context.taskId,
  sessionId: context.sessionId,
  operationId: context.operationId,
  subject: subjectFromRequest(input, context),
  promptRef: context.promptRef,
  ...(input.command === undefined ? {} : { command: input.command }),
  ...(input.cwd === undefined ? {} : { cwd: input.cwd }),
  ...(input.proposedGrant?.filePaths === undefined ? {} : { filePaths: [...input.proposedGrant.filePaths] }),
  ...(context.worktreePath === undefined ? {} : { worktreePath: context.worktreePath }),
  ...(requestedScopeFromRequest(input) === undefined ? {} : { requestedScope: requestedScopeFromRequest(input) }),
  answerChannelRef: input.answerChannel.channelRef,
  answerChannelPersistable: input.answerChannel.persistable,
  requestedAt: context.requestedAt,
  ...(input.answerChannel.expiresAt === undefined ? {} : { expiresAt: input.answerChannel.expiresAt }),
  policyRef: context.policyRef,
  agentRequestEventId: context.agentRequestEventId,
});
