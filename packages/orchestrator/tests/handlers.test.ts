import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  analyzeRunHandler,
  listEligibleHandler,
  listTracksHandler,
  runExportHandler,
  runReportHandler,
  runWorkflowHandler,
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

async function createRunDirectory(): Promise<string> {
  const runPath = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-report-'));
  await mkdir(path.join(runPath, 'children'), { recursive: true });
  await writeFile(
    path.join(runPath, 'state.json'),
    JSON.stringify({
      runId: 'run-1',
      command: 'run-story',
      workspaceRoot: '/repo',
      artifactDir: runPath,
      status: 'complete',
      maxParallel: 1,
      startedAt: '2026-06-14T00:00:00.000Z',
      completedAt: '2026-06-14T00:01:00.000Z',
      active: [],
      completed: [{ storyId: 'LK02', ok: true, sessionId: 'session-1', completedAt: '2026-06-14T00:01:00.000Z' }],
      blockedStoryId: null,
      blockedReason: null,
    }),
  );
  await writeFile(
    path.join(runPath, 'events.ndjson'),
    `${JSON.stringify({
      recordedAt: '2026-06-14T00:00:30.000Z',
      eventAt: '2026-06-14T00:00:30.000Z',
      type: 'verification_passed',
      command: 'pnpm check',
      phase: 'final',
    })}\n`,
  );
  await writeFile(
    path.join(runPath, 'summary.json'),
    JSON.stringify({ schemaVersion: 1, artifactPaths: { summary: 'summary.json' }, unavailable: {} }),
  );
  await writeFile(path.join(runPath, 'rows.json'), JSON.stringify({ schemaVersion: 1, rows: [{ storyId: 'LK02' }] }));
  await writeFile(path.join(runPath, 'budgets.json'), JSON.stringify({ schemaVersion: 1, evaluations: [] }));
  await writeFile(
    path.join(runPath, 'transcripts.json'),
    JSON.stringify({
      schemaVersion: 1,
      transcripts: [
        {
          storyId: 'LK02',
          sessionId: 'session-1',
          sessionLogPath: '/sensitive/session.jsonl',
          status: 'missing',
          unavailableReason: 'session log path is missing',
        },
      ],
    }),
  );
  await writeFile(
    path.join(runPath, 'children', 'LK02.json'),
    JSON.stringify({ storyId: 'LK02', ok: true, sessionId: 'session-1', completedAt: '2026-06-14T00:01:00.000Z' }),
  );
  await writeFile(path.join(runPath, 'children', 'LK02.raw.json'), JSON.stringify({ secret: 'do not copy' }));
  await mkdir(path.join(runPath, 'sessions'), { recursive: true });
  await writeFile(
    path.join(runPath, 'sessions', 'session-1.jsonl'),
    [
      JSON.stringify({ type: 'session_meta', payload: { id: 'session-1' } }),
      JSON.stringify({
        type: 'event_msg',
        payload: {
          type: 'token_count',
          info: {
            total_token_usage: {
              input_tokens: 1,
              cached_input_tokens: 0,
              output_tokens: 2,
              reasoning_output_tokens: 0,
              total_tokens: 3,
            },
          },
        },
      }),
    ].join('\n'),
  );
  return runPath;
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

  it('blocks runtime dispatch when validation reports tracker errors', async () => {
    const root = await createWorkspace();
    await writeFile(
      path.join(root, 'docs/tracks/linkly/README.md'),
      trackerMarkdown.replace('| LK03 | Claimed | LK01 |', '| ZZ03 | Claimed | LK01 |'),
    );

    await expect(
      runWorkflowHandler(
        { kind: 'run-eligible', overrides: { cwd: root, track: 'linkly', dryRun: true } },
        { stdout: () => undefined },
      ),
    ).rejects.toThrow('tracker validation failed for linkly');
  });

  it('keeps analyze-run read-only while report generation writes report artifacts', async () => {
    const runPath = await createRunDirectory();

    await analyzeRunHandler(runPath, { sessionRoot: path.join(runPath, 'sessions') });

    await expect(readFile(path.join(runPath, 'analysis.json'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readFile(path.join(runPath, 'report.md'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });

    const report = await runReportHandler({ runPath, format: 'markdown', sessionRoot: path.join(runPath, 'sessions') });

    expect(report.written).toBe(true);
    expect(report.markdown).toContain('# WorkflowKit run report: run-1');
    expect(report.markdown).toContain('Transcript artifacts are path-only');
    expect(await readFile(path.join(runPath, 'analysis.json'), 'utf8')).toContain('"runId": "run-1"');
    expect(await readFile(path.join(runPath, 'report.md'), 'utf8')).toContain('WorkflowKit run report: run-1');
  });

  it('resolves relative report session roots against the invocation cwd', async () => {
    const runPath = await createRunDirectory();

    const report = await runReportHandler({ runPath, cwd: runPath, sessionRoot: 'sessions' });

    expect(report.analysis.children[0]).toMatchObject({
      storyId: 'LK02',
      metricsStatus: 'available',
    });
    expect(report.analysis.tokenTotals).toMatchObject({ totalTokens: 3 });
  });

  it('exports a bounded run bundle without raw child payloads or transcript contents', async () => {
    const runPath = await createRunDirectory();
    const out = path.join(runPath, 'exports', 'test');

    const result = await runExportHandler({
      runPath,
      out,
      include: 'full-bounded',
      sessionRoot: path.join(runPath, 'sessions'),
    });

    expect(result.files).toContainEqual(expect.objectContaining({ source: 'children/LK02.json', status: 'copied' }));
    expect(result.files).toContainEqual(
      expect.objectContaining({ source: 'children/LK02.raw.json', status: 'skipped' }),
    );
    await expect(readFile(path.join(out, 'children', 'LK02.raw.json'), 'utf8')).rejects.toMatchObject({
      code: 'ENOENT',
    });
    expect(await readFile(path.join(out, 'transcripts.json'), 'utf8')).toContain('/sensitive/session.jsonl');
    await expect(readFile('/sensitive/session.jsonl', 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('clears stale files before writing a new export bundle', async () => {
    const runPath = await createRunDirectory();
    const out = path.join(runPath, 'exports', 'latest');

    await runExportHandler({ runPath, out, include: 'full-bounded', sessionRoot: path.join(runPath, 'sessions') });
    expect(await readFile(path.join(out, 'events.ndjson'), 'utf8')).toContain('verification_passed');

    const summary = await runExportHandler({
      runPath,
      out,
      include: 'summary',
      sessionRoot: path.join(runPath, 'sessions'),
    });

    expect(summary.files).toContainEqual(expect.objectContaining({ source: 'events.ndjson', status: 'skipped' }));
    await expect(readFile(path.join(out, 'events.ndjson'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
