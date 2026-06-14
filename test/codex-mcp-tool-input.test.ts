import { describe, expect, it } from 'vitest';
import { buildGenericPrompt } from '../packages/orchestrator/src/drivers/codex-mcp/toolInput.js';
import type { ResolvedWorkflowConfig, WorkflowStory } from '../packages/orchestrator/src/types.js';

describe('codex MCP child prompt', () => {
  it('tells Codex children to inspect PR body reactions for approval', () => {
    const prompt = buildGenericPrompt(story(), config());

    expect(prompt).toContain('Check PR body reactions');
    expect(prompt).toContain('issue comments');
    expect(prompt).toContain('PR review comments');
    expect(prompt).toContain('A +1 reaction from bot `codex` means approval');
    expect(prompt).toContain('An eyes reaction from bot `codex` means review is pending');
    expect(prompt).toContain('Do not re-request review after a +1 reaction has been observed');
  });

  it('requires base freshness and verification before auto-merge', () => {
    const prompt = buildGenericPrompt(story(), config());

    expect(prompt).toContain('Before merge, fetch the latest `main`');
    expect(prompt).toContain('rebase or otherwise update the story branch onto `main`');
    expect(prompt).toContain('rerun the required verification after the base update');
    expect(prompt).toContain('If the base update conflicts or verification fails, stop and report the blocker');
  });
});

function story(): WorkflowStory {
  return {
    id: 'DLD07',
    title: 'Delivery workflow hardening',
    status: 'planned',
    owner: null,
    dependencies: [],
    eligible: true,
    blockedReason: null,
    metadata: {
      trackId: 'delivery',
      trackTitle: 'Delivery',
      trackerPath: 'docs/tracks/delivery/README.md',
      order: 1,
      plan: 'docs/superpowers/plans/dld07.md',
    },
  };
}

function config(): Pick<ResolvedWorkflowConfig, 'workspace' | 'git' | 'implement' | 'pr'> {
  return {
    workspace: { rootAbs: '/repo' },
    git: {
      strategy: 'worktree',
      branchPattern: 'story/{id}',
      baseBranch: 'main',
      commitOnBase: 'forbid',
      worktreeDir: '.worktrees',
    },
    pr: {
      create: true,
      ci: { wait: true, command: 'pnpm check' },
      review: {
        wait: 'bot',
        bot: 'codex',
        triageComments: true,
        maxFixBatches: 2,
        rerequestAfterFix: false,
        waitTimeoutMinutes: 30,
      },
      merge: { auto: true, method: 'squash', deleteBranch: true },
    },
    implement: {
      review: {
        prePr: { enabled: true, mode: 'subagent', maxLoops: 2, loopMode: 'incremental' },
        semanticChecks: { enabled: true },
      },
      subagents: { enabled: true, maxParallel: 2, allowWorkers: false },
    },
  };
}
