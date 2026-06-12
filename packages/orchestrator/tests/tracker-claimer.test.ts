import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { claimTrackerRow } from '../src/tracks/trackerClaimer.js';
import type { ResolvedWorkflowConfig, WorkflowStory } from '../src/types.js';

const trackerMarkdown = `---
title: Linkly tracker
status: approved
owner: —
---

| ID | Name | Depends on | Wave | Status | Spec | Plan | Owner | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| L001 | Foundation | — | 1 | done | [spec](../../specs/l001.md) | [plan](../../plans/l001.md) | — | — |
| L002 | Pilot \\| launch | L001 | 2 | specced | [spec\\|doc](../../specs/l002.md) | — | — | — |
`;

function config(root: string): ResolvedWorkflowConfig {
  return {
    version: 1,
    configPath: path.join(root, '.workflow/config.yaml'),
    workspace: { rootAbs: root },
    paths: {
      tracksDir: 'docs/tracks',
      tracksDirAbs: path.join(root, 'docs/tracks'),
      archiveDir: 'docs/tracks/archive',
      archiveDirAbs: path.join(root, 'docs/tracks/archive'),
    },
    artifacts: {
      rootDir: '.codex/agentic-workflow-kit',
      rootDirAbs: path.join(root, '.codex/agentic-workflow-kit'),
      runsDirAbs: path.join(root, '.codex/agentic-workflow-kit/runs'),
    },
    statuses: { eligible: ['specced'], inProgress: 'implementing', complete: ['done'] },
    tracker: { idPattern: '^[A-Z]+[0-9]+$' },
    git: {
      strategy: 'worktree',
      branchPattern: '{track}/{id-lc}-{slug}',
      baseBranch: 'main',
      commitOnBase: 'forbid',
      worktreeDir: '.worktrees',
    },
    pr: {
      create: true,
      ci: { wait: false, command: null },
      review: {
        wait: 'none',
        bot: 'none',
        triageComments: false,
        maxFixBatches: 1,
        rerequestAfterFix: false,
        waitTimeoutMinutes: 30,
      },
      merge: { auto: false, method: 'squash', deleteBranch: true },
    },
    implement: {
      review: {
        prePr: { enabled: true, mode: 'auto', maxLoops: 2, loopMode: 'incremental' },
        semanticChecks: { enabled: true },
      },
      subagents: { enabled: true, maxParallel: 2, allowWorkers: false },
    },
    orchestrator: {
      driver: 'codex-mcp',
      maxParallel: 2,
      stopLaunchingOnBlocked: true,
      childTimeoutMs: 1_800_000,
      childNoProgressTimeoutMs: 1_800_000,
      childStartupTimeoutMs: 60_000,
      childMaxRuntimeMs: 7_200_000,
    },
    codex: { childSession: { cwdAbs: root } },
  };
}

function story(): WorkflowStory {
  return {
    id: 'L002',
    title: 'Pilot | launch',
    status: 'specced',
    owner: null,
    dependencies: ['L001'],
    eligible: true,
    blockedReason: null,
    metadata: {
      trackId: 'linkly',
      trackTitle: 'Linkly tracker',
      trackerPath: 'docs/tracks/linkly/README.md',
      order: 10,
    },
  };
}

describe('claimTrackerRow', () => {
  it('claims an eligible row and preserves other markdown cells', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'awk-claim-'));
    const trackerPath = path.join(root, 'docs/tracks/linkly/README.md');
    await mkdir(path.dirname(trackerPath), { recursive: true });
    await writeFile(trackerPath, trackerMarkdown);

    const result = await claimTrackerRow({ config: config(root), story: story(), owner: 'awk:run-1:L002' });

    expect(result).toMatchObject({
      ok: true,
      story: { id: 'L002', status: 'implementing', owner: 'awk:run-1:L002', eligible: false },
    });
    const updated = await readFile(trackerPath, 'utf8');
    expect(updated).toContain(
      '| L002 | Pilot \\| launch | L001 | 2 | implementing | [spec\\|doc](../../specs/l002.md) | — | awk:run-1:L002 | — |',
    );
  });

  it('refuses to claim rows that are no longer eligible', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'awk-claim-owned-'));
    const trackerPath = path.join(root, 'docs/tracks/linkly/README.md');
    await mkdir(path.dirname(trackerPath), { recursive: true });
    await writeFile(
      trackerPath,
      trackerMarkdown.replace(
        '| L002 | Pilot \\| launch | L001 | 2 | specced | [spec\\|doc](../../specs/l002.md) | — | — | — |',
        '| L002 | Pilot \\| launch | L001 | 2 | specced | [spec\\|doc](../../specs/l002.md) | — | arye | — |',
      ),
    );

    const result = await claimTrackerRow({ config: config(root), story: story(), owner: 'awk:run-1:L002' });

    expect(result).toMatchObject({ ok: false, reason: 'owner is arye' });
  });
});
