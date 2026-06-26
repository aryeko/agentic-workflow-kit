import { describe, expect, it } from 'vitest';

import type { ApprovalContext, ApprovalRequest } from '../../../../src/index.js';

import { approvalContextFixture, approvalRequestFixture } from './fixtures.js';

describe('core-03-s1 approval request and context contracts', () => {
  it('requires promptRef and requestedAt while allowing worktreePath on both shapes', () => {
    const contextWithWorktreePath: ApprovalContext = approvalContextFixture({
      worktreePath: '/worktrees/run-01',
      subjectOverride: 'protected-policy-change',
    });
    const requestWithWorktreePath: ApprovalRequest = approvalRequestFixture({
      worktreePath: '/worktrees/run-01',
      subject: 'network',
      host: 'api.example.com',
    });

    expect(contextWithWorktreePath.promptRef).toBe('artifact://prompt-01');
    expect(contextWithWorktreePath.requestedAt).toBe('2026-06-26T09:00:00.000Z');
    expect(contextWithWorktreePath.worktreePath).toBe('/worktrees/run-01');
    expect(requestWithWorktreePath.requestedAt).toBe('2026-06-26T09:00:00.000Z');
    expect(requestWithWorktreePath.promptRef).toBe('artifact://prompt-01');
    expect(requestWithWorktreePath.worktreePath).toBe('/worktrees/run-01');
  });

  it('treats worktreePath as optional on both request and context', () => {
    const contextWithoutWorktreePath: ApprovalContext = approvalContextFixture();
    const requestWithoutWorktreePath: ApprovalRequest = approvalRequestFixture();

    expect(contextWithoutWorktreePath.worktreePath).toBeUndefined();
    expect(requestWithoutWorktreePath.worktreePath).toBeUndefined();
    expect(contextWithoutWorktreePath.subjectOverride).toBeUndefined();
    expect(requestWithoutWorktreePath.subject).toBe('command');
  });
});
