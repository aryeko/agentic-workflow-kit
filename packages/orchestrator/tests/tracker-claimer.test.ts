import { mkdir, mkdtemp, readdir, readFile, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { resolveCwdOnlyConfig } from '../src/config/configLoader.js';
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
    agents: resolveCwdOnlyConfig(root).agents,
    orchestrator: {
      driver: 'codex-mcp',
      maxParallel: 2,
      stopLaunchingOnBlocked: true,
      watch: { enabled: false, wait: false, intervalMs: 300_000, timeoutMs: 300_000 },
      childTimeoutMs: 1_800_000,
      childNoProgressTimeoutMs: 1_800_000,
      childStartupTimeoutMs: 60_000,
      childMaxRuntimeMs: 7_200_000,
    },
    childSession: { cwdAbs: root },
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

  it('reclaims a stale claim lock before claiming the row', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'awk-claim-stale-'));
    const trackerPath = path.join(root, 'docs/tracks/linkly/README.md');
    await mkdir(path.dirname(trackerPath), { recursive: true });
    await writeFile(trackerPath, trackerMarkdown);
    await writeFile(
      claimLockPath(trackerPath),
      JSON.stringify({
        owner: 'crashed-owner',
        pid: 999_999,
        createdAt: '2026-06-15T19:00:00.000Z',
        token: 'crashed-token',
      }),
    );

    const result = await claimTrackerRow({ config: config(root), story: story(), owner: 'awk:run-1:L002' });

    expect(result).toMatchObject({
      ok: true,
      story: { id: 'L002', status: 'implementing', owner: 'awk:run-1:L002' },
    });
  });

  it('serializes concurrent stale-lock reclaim attempts', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'awk-claim-stale-concurrent-'));
    const trackerPath = path.join(root, 'docs/tracks/linkly/README.md');
    await mkdir(path.dirname(trackerPath), { recursive: true });
    await writeFile(trackerPath, trackerMarkdown);
    await writeFile(
      claimLockPath(trackerPath),
      JSON.stringify({
        owner: 'crashed-owner',
        pid: 999_999,
        createdAt: '2026-06-15T19:00:00.000Z',
        token: 'crashed-token',
      }),
    );

    const results = await Promise.all([
      claimTrackerRow({ config: config(root), story: story(), owner: 'awk:run-1:L002' }),
      claimTrackerRow({ config: config(root), story: story(), owner: 'awk:run-2:L002' }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    await expect(reclaimIntentNames(trackerPath)).resolves.toEqual([]);
  });

  it('reclaims an abandoned reclaim intent before reclaiming a stale claim lock', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'awk-claim-reclaim-abandoned-'));
    const trackerPath = path.join(root, 'docs/tracks/linkly/README.md');
    const lockPath = claimLockPath(trackerPath);
    await mkdir(path.dirname(trackerPath), { recursive: true });
    await writeFile(trackerPath, trackerMarkdown);
    await writeFile(
      lockPath,
      JSON.stringify({
        owner: 'crashed-owner',
        pid: 999_999,
        createdAt: '2026-06-15T19:00:00.000Z',
        token: 'crashed-token',
      }),
    );
    await writeReclaimIntent(trackerPath, {
      owner: 'reclaim-owner',
      pid: 999_999,
      createdAt: '1970-01-01T00:00:00.000Z',
      token: 'stale-reclaim-token',
    });

    const result = await claimTrackerRow({ config: config(root), story: story(), owner: 'awk:run-1:L002' });

    expect(result).toMatchObject({
      ok: true,
      story: { id: 'L002', status: 'implementing', owner: 'awk:run-1:L002' },
    });
    await expect(reclaimIntentNames(trackerPath)).resolves.toEqual([]);
  });

  it('does not stale-reclaim a live reclaim intent', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'awk-claim-reclaim-live-'));
    const trackerPath = path.join(root, 'docs/tracks/linkly/README.md');
    const lockPath = claimLockPath(trackerPath);
    const liveIntent = await writeReclaimIntent(trackerPath, {
      owner: 'reclaim-owner',
      pid: process.pid,
      createdAt: '1970-01-01T00:00:00.000Z',
      token: 'live-reclaim-token',
    });
    await mkdir(path.dirname(trackerPath), { recursive: true });
    await writeFile(trackerPath, trackerMarkdown);
    await writeFile(
      lockPath,
      JSON.stringify({
        owner: 'crashed-owner',
        pid: 999_999,
        createdAt: '2026-06-15T19:00:00.000Z',
        token: 'crashed-token',
      }),
    );

    const result = await claimTrackerRow({ config: config(root), story: story(), owner: 'awk:run-1:L002' });

    expect(result).toMatchObject({
      ok: false,
      reason: 'tracker docs/tracks/linkly/README.md claim lock timed out',
    });
    await expect(reclaimIntentNames(trackerPath)).resolves.toEqual([path.basename(liveIntent)]);
  }, 10000);

  it('reclaims a stale legacy text claim lock by file age', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'awk-claim-legacy-stale-'));
    const trackerPath = path.join(root, 'docs/tracks/linkly/README.md');
    const lockPath = claimLockPath(trackerPath);
    await mkdir(path.dirname(trackerPath), { recursive: true });
    await writeFile(trackerPath, trackerMarkdown);
    await writeFile(lockPath, 'legacy-owner\n');
    await utimes(lockPath, new Date('2026-06-15T19:00:00.000Z'), new Date('2026-06-15T19:00:00.000Z'));

    const result = await claimTrackerRow({ config: config(root), story: story(), owner: 'awk:run-1:L002' });

    expect(result).toMatchObject({
      ok: true,
      story: { id: 'L002', status: 'implementing', owner: 'awk:run-1:L002' },
    });
  });

  it('respects a recent live claim lock', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'awk-claim-live-'));
    const trackerPath = path.join(root, 'docs/tracks/linkly/README.md');
    await mkdir(path.dirname(trackerPath), { recursive: true });
    await writeFile(trackerPath, trackerMarkdown);
    await writeFile(
      claimLockPath(trackerPath),
      JSON.stringify({
        owner: 'live-owner',
        pid: process.pid,
        createdAt: new Date().toISOString(),
        token: 'live-token',
      }),
    );

    const result = await claimTrackerRow({ config: config(root), story: story(), owner: 'awk:run-1:L002' });

    expect(result).toMatchObject({
      ok: false,
      reason: 'tracker docs/tracks/linkly/README.md claim lock timed out',
    });
  }, 10000);

  it('respects an old live claim lock', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'awk-claim-old-live-'));
    const trackerPath = path.join(root, 'docs/tracks/linkly/README.md');
    await mkdir(path.dirname(trackerPath), { recursive: true });
    await writeFile(trackerPath, trackerMarkdown);
    await writeFile(
      claimLockPath(trackerPath),
      JSON.stringify({
        owner: 'live-owner',
        pid: process.pid,
        createdAt: '1970-01-01T00:00:00.000Z',
        token: 'old-live-token',
      }),
    );

    const result = await claimTrackerRow({ config: config(root), story: story(), owner: 'awk:run-1:L002' });

    expect(result).toMatchObject({
      ok: false,
      reason: 'tracker docs/tracks/linkly/README.md claim lock timed out',
    });
  }, 10000);
});

function claimLockPath(trackerPath: string): string {
  return `${trackerPath}.claim-README.md.lock`;
}

async function reclaimIntentNames(trackerPath: string): Promise<string[]> {
  const lockPath = claimLockPath(trackerPath);
  return (await readdir(path.dirname(lockPath)))
    .filter((name) => name.startsWith(`${path.basename(lockPath)}.reclaim-`))
    .sort();
}

async function writeReclaimIntent(
  trackerPath: string,
  metadata: { owner: string; pid: number; createdAt: string; token: string },
): Promise<string> {
  const lockPath = claimLockPath(trackerPath);
  const intentPath = path.join(
    path.dirname(lockPath),
    `${path.basename(lockPath)}.reclaim-${metadata.pid}-${metadata.token}`,
  );
  await mkdir(path.dirname(intentPath), { recursive: true });
  await writeFile(intentPath, `${JSON.stringify(metadata, null, 2)}\n`);
  return intentPath;
}
