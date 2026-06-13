import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  listEligibleHandler,
  listTracksHandler,
  trackerMigrateHandler,
  trackerValidateHandler,
  watchRunHandler,
} from '../src/commands/handlers';

const trackerMarkdown = `---
title: Linkly tracker
status: approved
owner: —
---

# Linkly

## Status matrix

| ID | Name | Depends on | Wave | Status | Spec | Plan | Owner | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LK01 | Foundation | — | 1 | done | [spec](../../specs/lk01.md) | [plan](../../plans/lk01.md) | — | — |
| LK02 | Pilot | LK01 | 2 | specced | [spec](../../specs/lk02.md) | — | — | — |
| LK03 | Claimed | LK01 | 2 | specced | [spec](../../specs/lk03.md) | — | arye | — |

## Dependency graph

\`\`\`mermaid
flowchart TD
  LK01 --> LK02
\`\`\`
`;

async function createWorkspace(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-handlers-'));
  await mkdir(path.join(root, '.workflow'), { recursive: true });
  await mkdir(path.join(root, 'docs/tracks/linkly'), { recursive: true });
  await writeFile(path.join(root, '.workflow/config.yaml'), 'version: 1\n');
  await writeFile(path.join(root, 'docs/tracks/linkly/README.md'), trackerMarkdown);
  return root;
}

describe('orchestrator command handlers', () => {
  it('lists tracks from the resolved workflow config', async () => {
    const root = await createWorkspace();

    const result = await listTracksHandler({ cwd: root });

    expect(result.tracks).toHaveLength(1);
    expect(result.tracks[0]).toMatchObject({
      id: 'linkly',
      title: 'Linkly tracker',
      relativePath: 'docs/tracks/linkly/README.md',
    });
  });

  it('lists only eligible stories after dependency and owner filtering', async () => {
    const root = await createWorkspace();

    const result = await listEligibleHandler({ cwd: root, track: 'linkly' });

    expect(result.stories.map((story) => story.id)).toEqual(['LK02']);
  });

  it('uses watch defaults from the run config snapshot', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-watch-'));
    await mkdir(root, { recursive: true });
    await writeFile(path.join(root, 'state.json'), JSON.stringify({ status: 'running' }));
    await writeFile(
      path.join(root, 'config.resolved.json'),
      JSON.stringify({
        orchestrator: {
          watch: {
            enabled: false,
            wait: true,
            intervalMs: 1000,
            timeoutMs: 1,
          },
        },
      }),
    );

    const result = await watchRunHandler(root);

    expect(result.wait).toMatchObject({ timedOut: true });
  });

  it('validates a configured tracker and returns diagnostics', async () => {
    const root = await createWorkspace();

    const result = await trackerValidateHandler({ cwd: root, track: 'linkly' });

    expect(result.track.id).toBe('linkly');
    expect(result.report.ok).toBe(true);
    expect(result.report.summary).toMatchObject({ storyCount: 3, errorCount: 0 });
    expect(result.report.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'OWNER_CONFLICT', storyId: 'LK03', severity: 'warning' }),
    );
    expect(result.report.diagnostics).toContainEqual(
      expect.objectContaining({ code: 'STORY_BRIEF_MISSING', storyId: 'LK02', severity: 'warning' }),
    );
  });

  it('migrates a markdown backlog file without mutating the source', async () => {
    const root = await createWorkspace();
    const backlog = path.join(root, 'backlog.md');
    await writeFile(
      backlog,
      [
        '# Backlog',
        '',
        '| Key | Summary | Blocked By | Phase | State | Assignee |',
        '| --- | --- | --- | --- | --- | --- |',
        '| LK-10 | Import this | — | W1 | todo | — |',
      ].join('\n'),
    );

    const result = await trackerMigrateHandler({ from: 'backlog.md', track: 'linkly' }, { cwd: root });

    expect(result.report.ok).toBe(true);
    expect(result.report.summary.importedRows).toBe(1);
    expect(result.draftMarkdown).toContain(
      '| LK10 | Import this | — | W1 | specced | [brief](./stories/LK10.md) | — | — | — |',
    );
  });
});
