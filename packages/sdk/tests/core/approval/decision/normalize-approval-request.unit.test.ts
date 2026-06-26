import { describe, expect, it } from 'vitest';

import { normalizeApprovalRequest } from '../../../../src/core/approval/decision/index.js';

import { createAgentRequest, createContext } from './shared.js';

describe('core-03-s2 normalizeApprovalRequest', () => {
  it('copies trusted context fields and keeps worktreePath independent from agent cwd', () => {
    const request = createAgentRequest({ cwd: '/tmp/spoofed-cwd' });
    const context = createContext({
      worktreePath: '/workspace/story',
      requestedAt: '2026-06-26T09:02:00.000Z',
      promptRef: 'artifact://prompt-02',
    });

    const normalized = normalizeApprovalRequest(request, context);

    expect(normalized.runId).toBe(context.runId);
    expect(normalized.taskId).toBe(context.taskId);
    expect(normalized.operationId).toBe(context.operationId);
    expect(normalized.sessionId).toBe(context.sessionId);
    expect(normalized.policyRef).toBe(context.policyRef);
    expect(normalized.agentRequestEventId).toBe(context.agentRequestEventId);
    expect(normalized.requestedAt).toBe(context.requestedAt);
    expect(normalized.promptRef).toBe(context.promptRef);
    expect(normalized.worktreePath).toBe('/workspace/story');
    expect(normalized.cwd).toBe('/tmp/spoofed-cwd');
    expect(normalized.subject).toBe('command');
  });

  it('maps grant kinds to requested scope and lets subjectOverride win', () => {
    const request = createAgentRequest({
      kind: 'file-change',
      proposedGrant: {
        grantId: 'grant-01',
        kind: 'network-permission',
        scope: 'turn',
        networkHost: 'api.example.com',
        networkAction: 'allow',
        grantEventId: 'evt-grant-01',
      },
    });

    const normalized = normalizeApprovalRequest(request, createContext({ subjectOverride: 'protected-policy-change' }));

    expect(normalized.subject).toBe('protected-policy-change');
    expect(normalized.requestedScope).toBe('per-host');
  });

  it('threads file paths from file-change grant requests into the normalized risk input', () => {
    const normalized = normalizeApprovalRequest(
      createAgentRequest({
        kind: 'apply-patch',
        proposedGrant: {
          grantId: 'grant-file-change-01',
          kind: 'file-change-session',
          scope: 'session',
          filePaths: ['/etc/passwd', 'packages/sdk/src/index.ts'],
          grantEventId: 'evt-grant-file-change-01',
        },
      }),
      createContext({ worktreePath: '/workspace/story' }),
    );

    expect(normalized.filePaths).toEqual(['/etc/passwd', 'packages/sdk/src/index.ts']);
  });

  it('omits optional fields when the agent request does not provide them', () => {
    const normalized = normalizeApprovalRequest(
      createAgentRequest({
        kind: 'permissions',
        command: undefined,
        cwd: undefined,
        proposedGrant: undefined,
        answerChannel: {
          channelRef: 'channel-02',
          providerRequestId: 'provider-request-02',
          persistable: false,
          evidenceRef: 'evidence:request-02',
        },
      }),
      createContext({ worktreePath: undefined, subjectOverride: undefined }),
    );

    expect(normalized.command).toBeUndefined();
    expect(normalized.cwd).toBeUndefined();
    expect(normalized.worktreePath).toBeUndefined();
    expect(normalized.requestedScope).toBeUndefined();
    expect(normalized.expiresAt).toBeUndefined();
    expect(normalized.subject).toBe('permission');
  });
});
