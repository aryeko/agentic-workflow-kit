import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { projectInspectFacade, runPreviewFacade } from '../src/api/facade';

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
  const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-api-facade-'));
  await mkdir(path.join(root, '.workflow'), { recursive: true });
  await mkdir(path.join(root, 'docs/tracks/linkly'), { recursive: true });
  await writeFile(path.join(root, '.workflow/config.yaml'), 'version: 1\n');
  await writeFile(path.join(root, 'docs/tracks/linkly/README.md'), trackerMarkdown);
  return root;
}

describe('workflow API facade', () => {
  it('returns project inspection in the shared product envelope', async () => {
    const root = await createWorkspace();

    const envelope = await projectInspectFacade({ cwd: root, requestId: 'req-test' });

    expect(envelope).toMatchObject({
      ok: true,
      operation: 'workflow_project_inspect',
      apiVersion: '1',
      requestId: 'req-test',
      project: {
        repoRoot: root,
        configPath: '.workflow/config.yaml',
      },
      result: {
        project: {
          tracksDir: 'docs/tracks',
          tracks: [{ id: 'linkly', title: 'Linkly tracker' }],
        },
        capabilities: {
          runStory: true,
          runTrack: true,
          streaming: false,
          abort: false,
        },
      },
      warnings: [],
      artifacts: [
        {
          kind: 'config',
          path: '.workflow/config.yaml',
        },
      ],
    });
  });

  it('previews a story run through the shared envelope without changing legacy run handlers', async () => {
    const root = await createWorkspace();

    const envelope = await runPreviewFacade({
      cwd: root,
      requestId: 'req-story',
      target: { type: 'story', trackId: 'linkly', storyId: 'LK02' },
    });

    expect(envelope).toMatchObject({
      ok: true,
      operation: 'workflow_run_preview',
      requestId: 'req-story',
      result: {
        run: {
          status: 'dry-run',
          target: { type: 'story', trackId: 'linkly', storyId: 'LK02' },
        },
        dryRunDispatch: ['LK02'],
      },
      artifacts: [
        expect.objectContaining({
          kind: 'runRoot',
          description: 'Run artifact root',
        }),
      ],
      next: [
        expect.objectContaining({
          label: 'Start run',
          mcpTool: 'workflow_run_start',
        }),
      ],
    });
  });

  it('previews an eligible track run through the same request model', async () => {
    const root = await createWorkspace();

    const envelope = await runPreviewFacade({
      cwd: root,
      target: { type: 'track', trackId: 'linkly', mode: 'eligible' },
    });

    expect(envelope).toMatchObject({
      ok: true,
      operation: 'workflow_run_preview',
      result: {
        run: {
          status: 'dry-run',
          target: { type: 'track', trackId: 'linkly', mode: 'eligible' },
        },
        dryRunDispatch: ['LK02'],
      },
    });
  });

  it('maps facade failures to a structured error envelope', async () => {
    const root = await createWorkspace();

    const envelope = await runPreviewFacade({
      cwd: root,
      target: { type: 'track', trackId: 'missing', mode: 'eligible' },
    });

    expect(envelope).toMatchObject({
      ok: false,
      operation: 'workflow_run_preview',
      error: {
        code: 'TRACKER_INVALID',
        severity: 'error',
        retryable: false,
        message: expect.stringContaining('track missing was not found'),
      },
      warnings: [],
    });
  });
});
