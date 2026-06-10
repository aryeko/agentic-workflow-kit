import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
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

    const analyzeRun = result.tools.find((tool) => tool.name === 'analyze_run');
    expect(analyzeRun?.inputSchema.properties?.runPath).toMatchObject({
      description: expect.stringContaining('artifactDir returned by run_story or run_eligible'),
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
});
