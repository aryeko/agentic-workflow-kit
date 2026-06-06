#!/usr/bin/env node

import { realpathSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { registerOrchestratorTools } from './tools.js';

export function createOrchestratorMcpServer(): McpServer {
  const server = new McpServer({
    name: 'agentic-workflow-kit',
    version: '0.1.0',
  });
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
