import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { describe, expect, it } from 'vitest';

import { createOrchestratorMcpServer } from '../src/mcp/server';
import { ORCHESTRATOR_MCP_TOOLS } from '../src/mcp/tools';

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
  const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-mcp-server-'));
  await mkdir(path.join(root, '.workflow'), { recursive: true });
  await mkdir(path.join(root, 'docs/tracks/linkly'), { recursive: true });
  await writeFile(path.join(root, '.workflow/config.yaml'), 'version: 1\n');
  await writeFile(path.join(root, 'docs/tracks/linkly/README.md'), trackerMarkdown);
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
  it('registers the orchestrator tool surface', async () => {
    const { client, server } = await connectClient();

    const result = await client.listTools();

    expect(result.tools.map((tool) => tool.name).sort()).toEqual([...ORCHESTRATOR_MCP_TOOLS].sort());
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
});
