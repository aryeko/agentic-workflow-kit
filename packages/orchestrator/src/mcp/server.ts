#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerOrchestratorTools } from './tools.js';

export const SERVER_INSTRUCTIONS =
  'Use agentic-workflow-kit for tracker-driven repo delivery. Prefer list_tracks/list_stories/list_eligible before dispatch. Tools operate on the target repo cwd; pass cwd explicitly when the MCP session is not already running from that repo. run_story and run_eligible default to dry-run; set dryRun=false only after explicit user approval. Tracker state is authoritative for completion. Use watch_run and analyze_run to inspect launched runs.';

export function createOrchestratorMcpServer(): McpServer {
  const server = new McpServer(
    {
      name: 'agentic-workflow-kit',
      version: '0.1.0',
    },
    {
      instructions: SERVER_INSTRUCTIONS,
    },
  );
  registerOrchestratorTools(server);
  return server;
}

export async function startOrchestratorMcpServer(): Promise<void> {
  const server = createOrchestratorMcpServer();
  await server.connect(new StdioServerTransport());
}

if (isDirectMcpExecution()) {
  startOrchestratorMcpServer().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}

export function isDirectMcpExecution(entrypoint = process.argv[1], moduleUrl = import.meta.url): boolean {
  if (entrypoint === undefined) return false;
  try {
    return realpathSync(entrypoint) === realpathSync(fileURLToPath(moduleUrl));
  } catch {
    return false;
  }
}
