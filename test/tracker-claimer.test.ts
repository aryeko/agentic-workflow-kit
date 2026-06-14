import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
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
