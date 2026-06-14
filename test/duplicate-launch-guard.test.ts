import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { findDuplicateLaunch } from '../packages/orchestrator/src/runner/DuplicateLaunchGuard.js';
import type { ResolvedWorkflowConfig, WorkflowStory } from '../packages/orchestrator/src/types.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('duplicate launch guard', () => {
  it('ignores malformed launch records instead of throwing', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-duplicate-'));
    tempRoots.push(root);
    const runDir = path.join(root, 'runs/run-1/children');
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, 'AWK01.launch.json'), '{"storyId":');

    await expect(
      findDuplicateLaunch({
        story: story('AWK01'),
        config: config(root),
        activeChildren: [],
        now: '2026-06-14T10:00:00.000Z',
      }),
    ).resolves.toEqual({ conflict: null, ignored: [] });
  });
});

function story(id: string): WorkflowStory {
  return {
    id,
    title: 'Example',
    status: 'specced',
    owner: null,
    dependencies: [],
    eligible: true,
    blockedReason: null,
    metadata: {
      trackId: 'track',
      trackTitle: 'Track',
      trackerPath: 'docs/tracks/track/README.md',
      order: 1,
      wave: 'W1',
      spec: '—',
      plan: '—',
      pr: '—',
    },
  };
}

function config(root: string): ResolvedWorkflowConfig {
  return {
    workspace: { rootAbs: root },
    artifacts: { runsDirAbs: path.join(root, 'runs') },
    git: {
      strategy: 'branch',
      branchPattern: '{track}/{id-lc}-{slug}',
      baseBranch: 'main',
      commitOnBase: 'forbid',
      worktreeDir: '.worktrees',
    },
    orchestrator: { childStartupTimeoutMs: 1000 },
  } as ResolvedWorkflowConfig;
}
