import { describe, expect, it } from 'vitest';
import { GhCollaborationInspector } from '../src/collaboration/CollaborationInspector';

describe('GhCollaborationInspector', () => {
  it('reports verification unavailable when gh auth status fails', async () => {
    const inspector = new GhCollaborationInspector({
      execFile: async (command, args) => {
        if (command === 'gh' && args.join(' ') === 'auth status --hostname github.com') {
          throw new Error('not logged in');
        }
        throw new Error(`unexpected command ${command} ${args.join(' ')}`);
      },
    });

    const result = await inspector.inspectPullRequest({
      cwdAbs: '/repo',
      owner: 'aryeko',
      repo: 'agentic-workflow-kit',
      prNumber: 72,
      branchName: 'track/story',
      reviewBot: 'codex',
    });

    expect(result.available).toBe(false);
    expect(result.missingSignal).toBe('gh-auth');
  });

  it('maps gh PR, required checks, review, and branch state into verified evidence', async () => {
    const calls: string[] = [];
    const inspector = new GhCollaborationInspector({
      execFile: async (command, args) => {
        calls.push(`${command} ${args.join(' ')}`);
        if (args[0] === 'auth') return '';
        if (args[0] === 'pr' && args[1] === 'view') {
          return JSON.stringify({
            number: 72,
            url: 'https://github.com/aryeko/agentic-workflow-kit/pull/72',
            state: 'MERGED',
            mergeCommit: { oid: 'abc123' },
            mergedAt: '2026-06-14T05:30:00Z',
            reviewDecision: 'APPROVED',
            headRefName: 'track/story',
            statusCheckRollup: [
              { __typename: 'CheckRun', name: 'build', conclusion: 'SUCCESS', status: 'COMPLETED' },
              { __typename: 'StatusContext', context: 'lint', state: 'SUCCESS' },
            ],
            reviews: { nodes: [] },
            comments: { nodes: [] },
            reactionGroups: [{ content: 'THUMBS_UP', users: { nodes: [{ login: 'codex' }] } }],
          });
        }
        if (args[0] === 'api' && args.some((arg) => arg.includes('/branches/track%2Fstory'))) {
          throw new Error('not found');
        }
        throw new Error(`unexpected command ${command} ${args.join(' ')}`);
      },
    });

    const result = await inspector.inspectPullRequest({
      cwdAbs: '/repo',
      owner: 'aryeko',
      repo: 'agentic-workflow-kit',
      prNumber: 72,
      branchName: 'track/story',
      reviewBot: 'codex',
    });

    expect(result.available).toBe(true);
    expect(result.pr?.state).toBe('merged');
    expect(result.pr?.mergeCommitSha).toBe('abc123');
    expect(result.checks.every((check) => check.status === 'passed')).toBe(true);
    expect(result.review?.signal).toBe('approved');
    expect(result.branch?.exists).toBe(false);
    expect(calls).toContain('gh auth status --hostname github.com');
  });

  it('fails closed when branch cleanup cannot be verified', async () => {
    const inspector = new GhCollaborationInspector({
      execFile: async (_command, args) => {
        if (args[0] === 'auth') return '';
        if (args[0] === 'pr' && args[1] === 'view') {
          return JSON.stringify({
            number: 72,
            url: 'https://github.com/aryeko/agentic-workflow-kit/pull/72',
            state: 'MERGED',
            mergeCommit: { oid: 'abc123' },
            headRefName: 'track/story',
            statusCheckRollup: [{ name: 'build', conclusion: 'SUCCESS' }],
            reactionGroups: [{ content: 'THUMBS_UP', users: { nodes: [{ login: 'codex' }] } }],
          });
        }
        if (args[0] === 'api') throw new Error('network down');
        throw new Error(`unexpected args ${args.join(' ')}`);
      },
    });

    const result = await inspector.inspectPullRequest({
      cwdAbs: '/repo',
      owner: 'aryeko',
      repo: 'agentic-workflow-kit',
      prNumber: 72,
      branchName: 'track/story',
      reviewBot: 'codex',
    });

    expect(result.available).toBe(false);
    expect(result.missingSignal).toBe('branch-state');
  });

  it('pins parent-side merge to the verified PR head SHA', async () => {
    const calls: string[] = [];
    const inspector = new GhCollaborationInspector({
      execFile: async (_command, args) => {
        calls.push(args.join(' '));
        if (args[0] === 'auth') return '';
        if (args[0] === 'pr' && args[1] === 'merge') return '';
        if (args[0] === 'pr' && args[1] === 'view') {
          return JSON.stringify({
            number: 72,
            url: 'https://github.com/aryeko/agentic-workflow-kit/pull/72',
            state: 'MERGED',
            headRefOid: 'head-sha',
            mergeCommit: { oid: 'merge-sha' },
            headRefName: 'track/story',
            statusCheckRollup: [{ name: 'build', conclusion: 'SUCCESS' }],
            reactionGroups: [{ content: 'THUMBS_UP', users: { nodes: [{ login: 'codex' }] } }],
          });
        }
        if (args[0] === 'api') throw new Error('not found');
        throw new Error(`unexpected args ${args.join(' ')}`);
      },
    });

    await inspector.mergePullRequest({
      cwdAbs: '/repo',
      owner: 'aryeko',
      repo: 'agentic-workflow-kit',
      prNumber: 72,
      method: 'squash',
      deleteBranch: true,
      branchName: 'track/story',
      reviewBot: 'codex',
      expectedHeadSha: 'head-sha',
    });

    expect(calls).toContain(
      'pr merge 72 --repo aryeko/agentic-workflow-kit --squash --delete-branch --match-head-commit head-sha',
    );
  });

  it('uses branch-protection required checks instead of optional failed rollup checks', async () => {
    const inspector = new GhCollaborationInspector({
      execFile: async (_command, args) => {
        if (args[0] === 'auth') return '';
        if (args[0] === 'pr' && args[1] === 'view') {
          return JSON.stringify({
            number: 72,
            url: 'https://github.com/aryeko/agentic-workflow-kit/pull/72',
            state: 'OPEN',
            headRefOid: 'head-sha',
            headRefName: 'track/story',
            baseRefName: 'main',
            statusCheckRollup: [
              { name: 'required-build', conclusion: 'SUCCESS' },
              { name: 'optional-nightly', conclusion: 'FAILURE' },
            ],
            reactionGroups: [{ content: 'THUMBS_UP', users: { nodes: [{ login: 'codex' }] } }],
          });
        }
        if (args[0] === 'api' && args.some((arg) => arg.includes('/branches/main/protection/required_status_checks'))) {
          return JSON.stringify({ contexts: ['required-build'] });
        }
        if (args[0] === 'api' && args.some((arg) => arg.includes('/branches/track%2Fstory'))) {
          return JSON.stringify({});
        }
        throw new Error(`unexpected args ${args.join(' ')}`);
      },
    });

    const result = await inspector.inspectPullRequest({
      cwdAbs: '/repo',
      owner: 'aryeko',
      repo: 'agentic-workflow-kit',
      prNumber: 72,
      branchName: 'track/story',
      reviewBot: 'codex',
    });

    expect(result.available).toBe(true);
    expect(result.checks).toEqual([expect.objectContaining({ command: 'required-build', status: 'passed' })]);
  });

  it('does not treat aggregate native approval as approval for a configured bot gate', async () => {
    const inspector = new GhCollaborationInspector({
      execFile: async (_command, args) => {
        if (args[0] === 'auth') return '';
        if (args[0] === 'pr' && args[1] === 'view') {
          return JSON.stringify({
            number: 72,
            url: 'https://github.com/aryeko/agentic-workflow-kit/pull/72',
            state: 'OPEN',
            headRefOid: 'head-sha',
            headRefName: 'track/story',
            baseRefName: 'main',
            reviewDecision: 'APPROVED',
            statusCheckRollup: [{ name: 'build', conclusion: 'SUCCESS' }],
            reactionGroups: [],
          });
        }
        if (args[0] === 'api' && args.some((arg) => arg.includes('/required_status_checks'))) {
          throw new Error('not found');
        }
        if (args[0] === 'api' && args.some((arg) => arg.includes('/branches/track%2Fstory'))) {
          return JSON.stringify({});
        }
        throw new Error(`unexpected args ${args.join(' ')}`);
      },
    });

    const result = await inspector.inspectPullRequest({
      cwdAbs: '/repo',
      owner: 'aryeko',
      repo: 'agentic-workflow-kit',
      prNumber: 72,
      branchName: 'track/story',
      reviewBot: 'codex',
    });

    expect(result.available).toBe(true);
    expect(result.review?.signal).toBe('unknown');
  });

  it('fails closed when required-check metadata cannot be queried', async () => {
    const inspector = new GhCollaborationInspector({
      execFile: async (_command, args) => {
        if (args[0] === 'auth') return '';
        if (args[0] === 'pr' && args[1] === 'view') {
          return JSON.stringify({
            number: 72,
            url: 'https://github.com/aryeko/agentic-workflow-kit/pull/72',
            state: 'OPEN',
            headRefOid: 'head-sha',
            headRefName: 'track/story',
            baseRefName: 'main',
            statusCheckRollup: [{ name: 'build', conclusion: 'SUCCESS' }],
          });
        }
        if (args[0] === 'api' && args.some((arg) => arg.includes('/required_status_checks'))) {
          throw new Error('network down');
        }
        throw new Error(`unexpected args ${args.join(' ')}`);
      },
    });

    const result = await inspector.inspectPullRequest({
      cwdAbs: '/repo',
      owner: 'aryeko',
      repo: 'agentic-workflow-kit',
      prNumber: 72,
      branchName: 'track/story',
      reviewBot: 'codex',
    });

    expect(result.available).toBe(false);
    expect(result.missingSignal).toBe('required-checks');
  });
});
