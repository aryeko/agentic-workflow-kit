import { access, mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseTrackerStories } from '../packages/orchestrator/src/tracks/markdownTracker.js';
import { claimTrackerRow } from '../packages/orchestrator/src/tracks/trackerClaimer.js';
import type { ResolvedWorkflowConfig } from '../packages/orchestrator/src/types.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('tracker claimer', () => {
  it('allows exactly one concurrent claimant for a branch-strategy row', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-claimer-'));
    tempRoots.push(root);
    const trackerPath = path.join(root, 'docs/tracks/track/README.md');
    await mkdir(path.dirname(trackerPath), { recursive: true });
    await writeFile(trackerPath, trackerMarkdown());
    const story = firstStory(await readFile(trackerPath, 'utf8'));
    const config = resolvedConfig(root);

    const results = await Promise.all([
      claimTrackerRow({ config, story, owner: 'owner-a' }),
      claimTrackerRow({ config, story, owner: 'owner-b' }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    const finalStory = firstStory(await readFile(trackerPath, 'utf8'));
    const winner = results.find((result) => result.ok);
    expect(finalStory.status).toBe('implementing');
    expect(finalStory.owner).toBe(winner?.story.owner);
  });

  it('preserves different-row concurrent claims in the same tracker file', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-claimer-'));
    tempRoots.push(root);
    const trackerPath = path.join(root, 'docs/tracks/track/README.md');
    await mkdir(path.dirname(trackerPath), { recursive: true });
    await writeFile(trackerPath, trackerMarkdown());
    const config = resolvedConfig(root);

    const results = await Promise.all([
      claimTrackerRow({ config, story: storyById(await readFile(trackerPath, 'utf8'), 'AWK01'), owner: 'owner-a' }),
      claimTrackerRow({ config, story: storyById(await readFile(trackerPath, 'utf8'), 'AWK02'), owner: 'owner-b' }),
    ]);

    expect(results.every((result) => result.ok)).toBe(true);
    const finalStories = parseTrackerStories(await readFile(trackerPath, 'utf8'), context());
    expect(finalStories.find((story) => story.id === 'AWK01')).toMatchObject({
      status: 'implementing',
      owner: 'owner-a',
    });
    expect(finalStories.find((story) => story.id === 'AWK02')).toMatchObject({
      status: 'implementing',
      owner: 'owner-b',
    });
  });

  it('reclaims an abandoned claim lock before claiming the row', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-claimer-'));
    tempRoots.push(root);
    const trackerPath = path.join(root, 'docs/tracks/track/README.md');
    await mkdir(path.dirname(trackerPath), { recursive: true });
    await writeFile(trackerPath, trackerMarkdown());
    await writeFile(
      claimLockPath(trackerPath),
      JSON.stringify({
        owner: 'crashed-owner',
        pid: 999_999,
        createdAt: '2026-06-15T19:00:00.000Z',
        token: 'crashed-token',
      }),
    );
    const config = resolvedConfig(root);

    const result = await claimTrackerRow({
      config,
      story: firstStory(await readFile(trackerPath, 'utf8')),
      owner: 'owner-a',
    });

    expect(result).toMatchObject({ ok: true });
    expect(firstStory(await readFile(trackerPath, 'utf8'))).toMatchObject({
      status: 'implementing',
      owner: 'owner-a',
    });
  });

  it('serializes concurrent stale-lock reclaim attempts', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-claimer-'));
    tempRoots.push(root);
    const trackerPath = path.join(root, 'docs/tracks/track/README.md');
    await mkdir(path.dirname(trackerPath), { recursive: true });
    await writeFile(trackerPath, trackerMarkdown());
    await writeFile(
      claimLockPath(trackerPath),
      JSON.stringify({
        owner: 'crashed-owner',
        pid: 999_999,
        createdAt: '2026-06-15T19:00:00.000Z',
        token: 'crashed-token',
      }),
    );
    const config = resolvedConfig(root);
    const story = firstStory(await readFile(trackerPath, 'utf8'));

    const results = await Promise.all([
      claimTrackerRow({ config, story, owner: 'owner-a' }),
      claimTrackerRow({ config, story, owner: 'owner-b' }),
    ]);

    expect(results.filter((result) => result.ok)).toHaveLength(1);
    await expect(access(`${claimLockPath(trackerPath)}.reclaim`)).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('does not stale-reclaim the secondary reclaim mutex', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-claimer-'));
    tempRoots.push(root);
    const trackerPath = path.join(root, 'docs/tracks/track/README.md');
    const lockPath = claimLockPath(trackerPath);
    await mkdir(path.dirname(trackerPath), { recursive: true });
    await writeFile(trackerPath, trackerMarkdown());
    await writeFile(
      lockPath,
      JSON.stringify({
        owner: 'crashed-owner',
        pid: 999_999,
        createdAt: '2026-06-15T19:00:00.000Z',
        token: 'crashed-token',
      }),
    );
    await writeFile(
      `${lockPath}.reclaim`,
      JSON.stringify({
        owner: 'reclaim-owner',
        pid: 999_999,
        createdAt: '1970-01-01T00:00:00.000Z',
        token: 'stale-reclaim-token',
      }),
    );
    const config = resolvedConfig(root);

    const result = await claimTrackerRow({
      config,
      story: firstStory(await readFile(trackerPath, 'utf8')),
      owner: 'owner-a',
    });

    expect(result).toMatchObject({
      ok: false,
      reason: 'tracker docs/tracks/track/README.md claim lock timed out',
    });
    await expect(access(`${lockPath}.reclaim`)).resolves.toBeUndefined();
  }, 10000);

  it('reclaims a stale legacy text claim lock by file age', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-claimer-'));
    tempRoots.push(root);
    const trackerPath = path.join(root, 'docs/tracks/track/README.md');
    const lockPath = claimLockPath(trackerPath);
    await mkdir(path.dirname(trackerPath), { recursive: true });
    await writeFile(trackerPath, trackerMarkdown());
    await writeFile(lockPath, 'legacy-owner\n');
    await utimes(lockPath, new Date('2026-06-15T19:00:00.000Z'), new Date('2026-06-15T19:00:00.000Z'));
    const config = resolvedConfig(root);

    const result = await claimTrackerRow({
      config,
      story: firstStory(await readFile(trackerPath, 'utf8')),
      owner: 'owner-a',
    });

    expect(result).toMatchObject({ ok: true });
    expect(firstStory(await readFile(trackerPath, 'utf8'))).toMatchObject({
      status: 'implementing',
      owner: 'owner-a',
    });
  });

  it('respects a recent live claim lock', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-claimer-'));
    tempRoots.push(root);
    const trackerPath = path.join(root, 'docs/tracks/track/README.md');
    await mkdir(path.dirname(trackerPath), { recursive: true });
    await writeFile(trackerPath, trackerMarkdown());
    await writeFile(
      claimLockPath(trackerPath),
      JSON.stringify({
        owner: 'live-owner',
        pid: process.pid,
        createdAt: new Date().toISOString(),
        token: 'live-token',
      }),
    );
    const config = resolvedConfig(root);

    const result = await claimTrackerRow({
      config,
      story: firstStory(await readFile(trackerPath, 'utf8')),
      owner: 'owner-a',
    });

    expect(result).toMatchObject({
      ok: false,
      reason: 'tracker docs/tracks/track/README.md claim lock timed out',
    });
    expect(firstStory(await readFile(trackerPath, 'utf8'))).toMatchObject({
      status: 'specced',
      owner: null,
    });
  }, 10000);

  it('respects an old live claim lock', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-claimer-'));
    tempRoots.push(root);
    const trackerPath = path.join(root, 'docs/tracks/track/README.md');
    await mkdir(path.dirname(trackerPath), { recursive: true });
    await writeFile(trackerPath, trackerMarkdown());
    await writeFile(
      claimLockPath(trackerPath),
      JSON.stringify({
        owner: 'live-owner',
        pid: process.pid,
        createdAt: '1970-01-01T00:00:00.000Z',
        token: 'old-live-token',
      }),
    );
    const config = resolvedConfig(root);

    const result = await claimTrackerRow({
      config,
      story: firstStory(await readFile(trackerPath, 'utf8')),
      owner: 'owner-a',
    });

    expect(result).toMatchObject({
      ok: false,
      reason: 'tracker docs/tracks/track/README.md claim lock timed out',
    });
    expect(firstStory(await readFile(trackerPath, 'utf8'))).toMatchObject({
      status: 'specced',
      owner: null,
    });
  }, 10000);
});

function resolvedConfig(root: string): ResolvedWorkflowConfig {
  return {
    workspace: { rootAbs: root },
    statuses: {
      eligible: ['specced', 'plan-approved'],
      inProgress: 'implementing',
      complete: ['done', 'verified'],
    },
    tracker: { idPattern: '^[A-Z]{2,}[0-9]+$' },
  } as ResolvedWorkflowConfig;
}

function firstStory(markdown: string) {
  return storyById(markdown, 'AWK01');
}

function storyById(markdown: string, storyId: string) {
  const match = parseTrackerStories(markdown, context()).find((entry) => entry.id === storyId);
  if (!match) throw new Error(`expected tracker story ${storyId}`);
  return match;
}

function context() {
  return {
    completeStatuses: new Set(['done', 'verified']),
    eligibleStatuses: new Set(['specced', 'plan-approved']),
    idPattern: /^[A-Z]{2,}[0-9]+$/,
    trackId: 'track',
    trackTitle: 'Track',
    trackerPath: 'docs/tracks/track/README.md',
  };
}

function trackerMarkdown(): string {
  return `# Track

## Status matrix

| ID | Name | Depends on | Wave | Status | Spec | Plan | Owner | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AWK01 | Example | — | W1 | specced | [brief](./stories/AWK01.md) | — | — | — |
| AWK02 | Next | — | W1 | specced | [brief](./stories/AWK02.md) | — | — | — |
`;
}

function claimLockPath(trackerPath: string): string {
  return `${trackerPath}.claim-README.md.lock`;
}
