import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it } from 'vitest';

import { createOrchestratorMcpServer } from '../src/mcp/server';
import { ORCHESTRATOR_MCP_TOOLS } from '../src/mcp/tools';

const originalInitCwd = process.env.INIT_CWD;

function trackerMarkdown(storyCount = 3): string {
  const generatedRows =
    storyCount <= 3
      ? [
          '| LK01 | Foundation | - | 1 | done | [spec](../../specs/lk01.md) | [plan](../../plans/lk01.md) | - | - |',
          '| LK02 | Pilot | LK01 | 2 | specced | [spec](../../specs/lk02.md) | - | - | - |',
          '| LK03 | Claimed | LK01 | 2 | specced | [spec](../../specs/lk03.md) | - | arye | - |',
        ]
      : Array.from(
          { length: storyCount },
          (_, index) =>
            `| LK${String(index + 1).padStart(2, '0')} | Story ${index + 1} | - | 1 | specced | [spec](../../specs/lk${index + 1}.md) | - | - | - |`,
        );

  return `---
title: Linkly tracker
status: approved
owner: unassigned
---

# Linkly

## Status matrix

| ID | Name | Depends on | Wave | Status | Spec | Plan | Owner | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
${generatedRows.join('\n')}

## Dependency graph

\`\`\`mermaid
flowchart TD
  LK01 --> LK02
\`\`\`
`;
}

async function createWorkspace(options: { storyCount?: number; secondEligibleTrack?: boolean } = {}): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-mcp-server-'));
  await mkdir(path.join(root, '.workflow'), { recursive: true });
  await mkdir(path.join(root, 'docs/tracks/linkly'), { recursive: true });
  await writeFile(path.join(root, '.workflow/config.yaml'), 'version: 1\n');
  await writeFile(path.join(root, 'docs/tracks/linkly/README.md'), trackerMarkdown(options.storyCount));
  if (options.secondEligibleTrack) {
    await mkdir(path.join(root, 'docs/tracks/billing'), { recursive: true });
    await writeFile(path.join(root, 'docs/tracks/billing/README.md'), trackerMarkdown(1));
  }
  return root;
}

async function createAnalyzableRun(): Promise<{ runPath: string; sessionRoot: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-mcp-analyze-'));
  const runDir = path.join(root, 'runs/run-1');
  const sessionRoot = path.join(root, 'sessions');
  await mkdir(path.join(runDir, 'children'), { recursive: true });
  await mkdir(sessionRoot, { recursive: true });
  await writeFile(
    path.join(runDir, 'state.json'),
    JSON.stringify({
      runId: 'run-1',
      status: 'blocked',
      blockedReason: 'DLD05 returned but status is implementing',
    }),
  );
  await writeFile(
    path.join(runDir, 'children', 'DLD05.json'),
    JSON.stringify({
      storyId: 'DLD05',
      ok: true,
      sessionId: 'thread-dld05',
      returnedStatus: 'implementing',
      completionAuthority: 'pr-policy-incomplete',
      completionAuthoritySource: 'child-worktree-tracker',
      evidence: {
        finalStatus: 'done',
        prNumber: 108,
        prUrl: 'https://github.com/aryeko/pathway/pull/108',
      },
    }),
  );
  await writeFile(
    path.join(runDir, 'events.ndjson'),
    [
      JSON.stringify({
        type: 'completion_authority',
        storyId: 'DLD05',
        authority: 'pr-policy-incomplete',
        source: 'child-worktree-tracker',
      }),
      JSON.stringify({ type: 'child-supervisor-poll', storyId: 'DLD05', eventAt: '2026-06-12T22:10:00.000Z' }),
    ].join('\n'),
  );
  return { runPath: runDir, sessionRoot };
}

async function createWatchRun(
  status: string,
  watch?: { wait?: boolean; intervalMs?: number; timeoutMs?: number },
): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-mcp-watch-'));
  const runDir = path.join(root, 'runs/run-1');
  await mkdir(runDir, { recursive: true });
  await writeFile(path.join(runDir, 'state.json'), JSON.stringify({ runId: 'run-1', status }));
  await writeFile(path.join(runDir, 'metrics.live.json'), JSON.stringify({ runId: 'run-1', status }));
  if (watch) {
    await writeFile(
      path.join(runDir, 'config.resolved.json'),
      JSON.stringify({
        orchestrator: {
          watch: {
            enabled: false,
            wait: watch.wait ?? false,
            intervalMs: watch.intervalMs ?? 300_000,
            timeoutMs: watch.timeoutMs ?? 300_000,
          },
        },
      }),
    );
  }
  return runDir;
}

async function connectClient() {
  const server = createOrchestratorMcpServer();
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { client, server };
}

describe('agentic-workflow-kit MCP server', () => {
  afterEach(() => {
    if (originalInitCwd === undefined) {
      delete process.env.INIT_CWD;
    } else {
      process.env.INIT_CWD = originalInitCwd;
    }
  });

  it('registers the orchestrator tool surface', async () => {
    const { client, server } = await connectClient();

    const result = await client.listTools();

    expect(result.tools.map((tool) => tool.name).sort()).toEqual([...ORCHESTRATOR_MCP_TOOLS].sort());
    for (const tool of result.tools) {
      expect(tool.outputSchema).toBeDefined();
    }

    const runEligible = result.tools.find((tool) => tool.name === 'run_eligible');
    expect(runEligible?.description).toContain('Defaults to dry-run');
    expect(runEligible?.description).toContain('unsupervised child sessions with full disk access');
    expect(runEligible?.inputSchema.properties?.cwd).toMatchObject({
      description: expect.stringContaining('Target repo root'),
    });
    expect(runEligible?.inputSchema.properties?.sandbox).toMatchObject({
      description: expect.stringContaining('full local disk access'),
    });
    expect(runEligible?.inputSchema.properties).not.toHaveProperty('watch');

    const projectInspect = result.tools.find((tool) => tool.name === 'workflow_project_inspect');
    expect(projectInspect?.description).toContain('Resolve WorkflowKit project context');

    const runPreview = result.tools.find((tool) => tool.name === 'workflow_run_preview');
    expect(runPreview?.description).toContain('Preview story or track execution');
    expect(runPreview?.inputSchema.properties?.target).toBeDefined();

    const trackerValidate = result.tools.find((tool) => tool.name === 'workflow_tracker_validate');
    expect(trackerValidate?.description).toContain('Validate tracker contract');

    const trackerMigrate = result.tools.find((tool) => tool.name === 'workflow_tracker_migrate');
    expect(trackerMigrate?.description).toContain('Draft a kit tracker');
    expect(trackerMigrate?.inputSchema.properties?.from).toBeDefined();

    const analyzeRun = result.tools.find((tool) => tool.name === 'analyze_run');
    expect(analyzeRun?.inputSchema.properties?.runPath).toMatchObject({
      description: expect.stringContaining('artifactDir returned by run_story or run_eligible'),
    });
    await client.close();
    await server.close();
  });

  it('calls workflow_project_inspect with the product result envelope', async () => {
    const root = await createWorkspace();
    const { client, server } = await connectClient();

    const result = await client.callTool({
      name: 'workflow_project_inspect',
      arguments: { cwd: root, requestId: 'req-mcp' },
    });

    expect(result.structuredContent).toMatchObject({
      ok: true,
      operation: 'workflow_project_inspect',
      requestId: 'req-mcp',
      result: {
        project: { tracks: [{ id: 'linkly' }] },
        capabilities: { runStory: true, runTrack: true },
      },
    });
    await client.close();
    await server.close();
  });

  it('returns product MCP failures in the shared error envelope', async () => {
    const originalCwd = process.cwd();
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-mcp-product-no-workflow-'));
    const { client, server } = await connectClient();

    try {
      process.chdir(tempRoot);
      delete process.env.INIT_CWD;
      const result = await client.callTool({
        name: 'workflow_project_inspect',
        arguments: {},
      });

      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toMatchObject({
        ok: false,
        operation: 'workflow_project_inspect',
        error: {
          code: 'CONFIG_INVALID',
          severity: 'error',
        },
      });
    } finally {
      process.chdir(originalCwd);
      await client.close();
      await server.close();
    }
  });

  it('calls workflow_run_preview without removing legacy run_story dry-runs', async () => {
    const root = await createWorkspace();
    const { client, server } = await connectClient();

    const preview = await client.callTool({
      name: 'workflow_run_preview',
      arguments: { cwd: root, target: { type: 'story', trackId: 'linkly', storyId: 'LK02' } },
    });
    const legacy = await client.callTool({
      name: 'run_story',
      arguments: { cwd: root, track: 'linkly', storyId: 'LK02' },
    });

    expect(preview.structuredContent).toMatchObject({
      ok: true,
      operation: 'workflow_run_preview',
      result: { dryRunDispatch: ['LK02'] },
      artifacts: [],
      next: [expect.objectContaining({ mcpTool: 'run_story' })],
    });
    expect(legacy.structuredContent).toMatchObject({
      status: 'dry-run',
      dryRunDispatch: ['LK02'],
    });
    await client.close();
    await server.close();
  });

  it('calls list_eligible with structured results from the shared handlers', async () => {
    const root = await createWorkspace();
    const { client, server } = await connectClient();

    const result = await client.callTool({
      name: 'list_eligible',
      arguments: { cwd: root, track: 'linkly' },
    });

    expect(result.structuredContent).toMatchObject({
      stories: [{ id: 'LK02' }],
    });
    await client.close();
    await server.close();
  });

  it('calls workflow_tracker_validate with structured diagnostics', async () => {
    const root = await createWorkspace();
    const { client, server } = await connectClient();

    const result = await client.callTool({
      name: 'workflow_tracker_validate',
      arguments: { cwd: root, track: 'linkly' },
    });

    expect(result.structuredContent).toMatchObject({
      ok: true,
      operation: 'workflow_tracker_validate',
      result: {
        track: { id: 'linkly' },
        report: {
          ok: true,
          summary: { storyCount: 3, errorCount: 0 },
        },
      },
    });
    await client.close();
    await server.close();
  });

  it('calls workflow_tracker_migrate with a draft artifact and report', async () => {
    const root = await createWorkspace();
    const backlog = path.join(root, 'backlog.md');
    await writeFile(
      backlog,
      ['# Backlog', '', '| Key | Summary | State |', '| --- | --- | --- |', '| LK-10 | Import this | todo |'].join(
        '\n',
      ),
    );
    const { client, server } = await connectClient();

    const result = await client.callTool({
      name: 'workflow_tracker_migrate',
      arguments: { cwd: root, track: 'linkly', from: backlog },
    });

    expect(result.structuredContent).toMatchObject({
      ok: true,
      operation: 'workflow_tracker_migrate',
      result: {
        track: { id: 'linkly' },
        report: {
          ok: true,
          summary: { importedRows: 1 },
        },
      },
    });
    expect((result.structuredContent as { result?: { draftMarkdown?: string } }).result?.draftMarkdown).toContain(
      '| LK10 | Import this | — | W1 | specced |',
    );
    await client.close();
    await server.close();
  });

  it('defaults run_story to a dry-run', async () => {
    const root = await createWorkspace();
    const { client, server } = await connectClient();

    const result = await client.callTool({
      name: 'run_story',
      arguments: { cwd: root, track: 'linkly', storyId: 'LK02' },
    });

    expect(result.structuredContent).toMatchObject({
      status: 'dry-run',
      dryRunDispatch: ['LK02'],
    });
    await client.close();
    await server.close();
  });

  it('exposes workflow_run_control and appends abort artifacts', async () => {
    const runPath = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-mcp-control-'));
    await writeFile(
      path.join(runPath, 'state.json'),
      JSON.stringify({
        runId: 'run-1',
        status: 'running',
        active: [],
        completed: [],
        blockedStoryId: null,
        blockedReason: null,
      }),
    );
    const { client, server } = await connectClient();

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toContain('workflow_run_control');
    const result = await client.callTool({
      name: 'workflow_run_control',
      arguments: { runPath, action: 'abort', reason: 'operator stop' },
    });

    expect(result.structuredContent).toMatchObject({
      ok: true,
      outcome: 'applied',
      artifacts: { controls: 'controls.ndjson', events: 'events.ndjson', state: 'state.json' },
    });
    expect(await readFile(path.join(runPath, 'controls.ndjson'), 'utf8')).toContain('"action":"abort"');
    expect(await readFile(path.join(runPath, 'events.ndjson'), 'utf8')).toContain('"type":"run-aborted"');
    await client.close();
    await server.close();
  });

  it('returns handler errors as MCP tool errors', async () => {
    const root = await createWorkspace({ secondEligibleTrack: true });
    const { client, server } = await connectClient();

    const result = await client.callTool({
      name: 'run_eligible',
      arguments: { cwd: root },
    });

    expect(result.isError).toBe(true);
    expect(result.content).toEqual([
      {
        type: 'text',
        text: expect.stringContaining('multiple tracks have eligible stories'),
      },
    ]);
    await client.close();
    await server.close();
  });

  it('requires an explicit cwd when the MCP session is not in a workflow repo', async () => {
    const originalCwd = process.cwd();
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-mcp-no-workflow-'));
    const { client, server } = await connectClient();

    try {
      process.chdir(tempRoot);
      delete process.env.INIT_CWD;
      const result = await client.callTool({
        name: 'list_tracks',
        arguments: {},
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent).toMatchObject({
        error: expect.stringContaining('Pass cwd as the target repository root'),
      });
    } finally {
      process.chdir(originalCwd);
      await client.close();
      await server.close();
    }
  });

  it('truncates large structured responses by default', async () => {
    const root = await createWorkspace({ storyCount: 75 });
    const { client, server } = await connectClient();

    const result = await client.callTool({
      name: 'list_stories',
      arguments: { cwd: root, track: 'linkly' },
    });

    expect(result.structuredContent).toMatchObject({
      truncated: true,
      truncation: {
        paths: expect.arrayContaining(['$.stories']),
      },
    });
    expect((result.structuredContent as { stories: unknown[] }).stories.length).toBe(51);
    await client.close();
    await server.close();
  });

  it('returns concise analyze_run structured content by default', async () => {
    const { runPath, sessionRoot } = await createAnalyzableRun();
    const { client, server } = await connectClient();

    const result = await client.callTool({
      name: 'analyze_run',
      arguments: { runPath, sessionRoot },
    });

    expect(result.structuredContent).toMatchObject({
      runId: 'run-1',
      status: 'blocked',
      issues: expect.arrayContaining([
        'DLD05 PR policy incomplete: auto-merge policy has not produced merged evidence',
      ]),
      children: [
        expect.objectContaining({
          storyId: 'DLD05',
          completionAuthority: 'pr-policy-incomplete',
          completionAuthoritySource: 'child-worktree-tracker',
        }),
      ],
    });
    expect(result.structuredContent).not.toHaveProperty('timeline');
    expect(result.structuredContent).not.toHaveProperty('commandCounts');
    expect(result.structuredContent).not.toHaveProperty('tokenTotals');
    await client.close();
    await server.close();
  });

  it('keeps detailed analyze_run structured content when requested', async () => {
    const { runPath, sessionRoot } = await createAnalyzableRun();
    const { client, server } = await connectClient();

    const result = await client.callTool({
      name: 'analyze_run',
      arguments: { runPath, sessionRoot, responseFormat: 'detailed' },
    });

    expect(result.structuredContent).toMatchObject({
      runId: 'run-1',
      commandCounts: {},
      tokenTotals: null,
      timeline: [
        expect.objectContaining({ type: 'completion_authority' }),
        expect.objectContaining({ type: 'child-supervisor-poll' }),
      ],
    });
    await client.close();
    await server.close();
  });

  it('waits in watch_run until timeout when a run stays running', async () => {
    const runPath = await createWatchRun('running');
    const { client, server } = await connectClient();

    const result = await client.callTool({
      name: 'watch_run',
      arguments: { runPath, wait: true, intervalMs: 1, timeoutMs: 1 },
    });

    expect(result.structuredContent).toMatchObject({
      state: { runId: 'run-1', status: 'running' },
      wait: { timedOut: true },
    });
    await client.close();
    await server.close();
  });

  it('lets explicit MCP wait false override a run config wait default', async () => {
    const runPath = await createWatchRun('running', { wait: true, intervalMs: 1, timeoutMs: 1 });
    const { client, server } = await connectClient();

    const result = await client.callTool({
      name: 'watch_run',
      arguments: { runPath, wait: false, intervalMs: 1, timeoutMs: 1 },
    });

    expect(result.structuredContent).toMatchObject({
      state: { runId: 'run-1', status: 'running' },
    });
    expect((result.structuredContent as { wait?: unknown }).wait).toBeUndefined();
    await client.close();
    await server.close();
  });
});
