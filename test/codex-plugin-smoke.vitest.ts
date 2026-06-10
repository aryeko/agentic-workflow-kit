import { type ChildProcessWithoutNullStreams, execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const pluginVersion = JSON.parse(readFileSync(path.join(repoRoot, '.codex-plugin/plugin.json'), 'utf8')).version;
const MCP_TIMEOUT_MS = 10_000;

describe('codex local plugin smoke', () => {
  it('installs through the local marketplace and exposes implicit-safe skills', () => {
    const codexHome = mkdtempSync(path.join(tmpdir(), 'agentic-workflow-kit-codex-home-'));
    const env = { ...process.env, CODEX_HOME: codexHome };

    execFileSync('codex', ['plugin', 'marketplace', 'add', '.'], {
      cwd: repoRoot,
      env,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    execFileSync('codex', ['plugin', 'add', 'agentic-workflow-kit@agentic-workflow-kit'], {
      cwd: repoRoot,
      env,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const installedRoot = path.join(
      codexHome,
      `plugins/cache/agentic-workflow-kit/agentic-workflow-kit/${pluginVersion}`,
    );

    expect(existsSync(path.join(installedRoot, '.codex-plugin/plugin.json'))).toBe(true);
    expect(existsSync(path.join(installedRoot, '.codex-plugin/.mcp.json'))).toBe(true);
    expect(existsSync(path.join(installedRoot, '.mcp.json'))).toBe(true);
    expect(existsSync(path.join(installedRoot, 'mcp/server.mjs'))).toBe(true);
    const installedManifest = JSON.parse(readFileSync(path.join(installedRoot, '.codex-plugin/plugin.json'), 'utf8'));
    const installedMcp = JSON.parse(readFileSync(path.join(installedRoot, installedManifest.mcpServers), 'utf8'));
    expect(installedManifest.mcpServers).toBe('./.codex-plugin/.mcp.json');
    expect(installedMcp.mcpServers?.['agentic-workflow-kit']).toEqual({
      cwd: '.',
      command: 'node',
      args: ['./mcp/server.mjs'],
    });
    expect(installedMcp.mcp_servers).toBeUndefined();
    expect(existsSync(path.join(installedRoot, 'skills/workflow-init/SKILL.md'))).toBe(true);
    expect(existsSync(path.join(installedRoot, 'skills/define-product/SKILL.md'))).toBe(true);
    expect(existsSync(path.join(installedRoot, 'skills/design-technical-solution/SKILL.md'))).toBe(true);
    expect(existsSync(path.join(installedRoot, 'skills/plan-delivery-track/SKILL.md'))).toBe(true);
    expect(existsSync(path.join(installedRoot, 'skills/implement-next/SKILL.md'))).toBe(true);
    expect(existsSync(path.join(installedRoot, 'skills/workflow-autopilot/SKILL.md'))).toBe(true);

    const promptInput = execFileSync('codex', ['debug', 'prompt-input', 'hello'], {
      cwd: repoRoot,
      env,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    expect(promptInput).toContain('agentic-workflow-kit:workflow-init');
    expect(promptInput).toContain('agentic-workflow-kit:define-product');
    expect(promptInput).toContain('agentic-workflow-kit:design-technical-solution');
    expect(promptInput).toContain('agentic-workflow-kit:plan-delivery-track');
  }, 30_000);

  it('starts the installed bundled MCP server from a non-plugin consumer cwd', async () => {
    const codexHome = mkdtempSync(path.join(tmpdir(), 'agentic-workflow-kit-codex-home-'));
    const consumerCwd = mkdtempSync(path.join(tmpdir(), 'agentic-workflow-kit-consumer-'));
    mkdirSync(path.join(consumerCwd, '.git'));
    const env = { ...process.env, CODEX_HOME: codexHome };

    execFileSync('codex', ['plugin', 'marketplace', 'add', '.'], {
      cwd: repoRoot,
      env,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    execFileSync('codex', ['plugin', 'add', 'agentic-workflow-kit@agentic-workflow-kit'], {
      cwd: repoRoot,
      env,
      encoding: 'utf8',
      stdio: 'pipe',
    });

    const installedRoot = path.join(
      codexHome,
      `plugins/cache/agentic-workflow-kit/agentic-workflow-kit/${pluginVersion}`,
    );
    const installedManifest = JSON.parse(readFileSync(path.join(installedRoot, '.codex-plugin/plugin.json'), 'utf8'));
    const installedMcp = JSON.parse(readFileSync(path.join(installedRoot, installedManifest.mcpServers), 'utf8'));
    const mcpEntry = installedMcp.mcpServers?.['agentic-workflow-kit'];

    expect(mcpEntry).toEqual({
      cwd: '.',
      command: 'node',
      args: ['./mcp/server.mjs'],
    });

    const server = spawn(mcpEntry.command, mcpEntry.args, {
      cwd: mcpEntry.cwd === undefined ? consumerCwd : path.resolve(installedRoot, mcpEntry.cwd),
      stdio: 'pipe',
    });
    const session = createMcpSession(server);

    try {
      await session.request({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'agentic-workflow-kit-codex-smoke', version: '1.0.0' },
        },
      });
      session.notify({
        jsonrpc: '2.0',
        method: 'notifications/initialized',
      });

      const result = await session.request({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      });
      const toolNames = readToolNames(result);

      expect(toolNames).toContain('list_eligible');
      expect(toolNames).toContain('run_story');
    } finally {
      server.kill();
    }
  }, 30_000);
});

function createMcpSession(server: ChildProcessWithoutNullStreams) {
  let stdout = Buffer.alloc(0);
  let stderr = '';

  server.stdout.on('data', (chunk: Buffer) => {
    stdout = Buffer.concat([stdout, chunk]);
  });
  server.stderr.on('data', (chunk: Buffer) => {
    stderr += chunk.toString('utf8');
  });

  const writeMessage = (message: Record<string, unknown>) => {
    server.stdin.write(`${JSON.stringify(message)}\n`);
  };

  return {
    notify(message: Record<string, unknown>) {
      writeMessage(message);
    },
    async request(message: { id: number } & Record<string, unknown>) {
      writeMessage(message);
      return await readResponse(message.id);
    },
  };

  async function readResponse(id: number): Promise<Record<string, unknown>> {
    const deadline = Date.now() + MCP_TIMEOUT_MS;
    while (Date.now() < deadline) {
      const parsed = shiftMessage();
      if (parsed && parsed.id === id) {
        if ('error' in parsed) {
          throw new Error(`MCP request ${id} failed: ${JSON.stringify(parsed.error)}`);
        }
        return parsed.result as Record<string, unknown>;
      }
      if (server.exitCode !== null) {
        throw new Error(`MCP server exited before response ${id}; stderr: ${stderr}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw new Error(`Timed out waiting for MCP response ${id}; stderr: ${stderr}`);
  }

  function shiftMessage(): Record<string, unknown> | null {
    const newline = stdout.indexOf('\n');
    if (newline === -1) return null;

    const line = stdout.subarray(0, newline).toString('utf8').replace(/\r$/, '');
    stdout = stdout.subarray(newline + 1);
    return JSON.parse(line) as Record<string, unknown>;
  }
}

function readToolNames(value: Record<string, unknown>): string[] {
  if (!Array.isArray(value.tools)) {
    throw new Error(`MCP tools/list result missing tools array: ${JSON.stringify(value)}`);
  }

  return value.tools.map((tool, index) => {
    if (!isRecord(tool) || typeof tool.name !== 'string') {
      throw new Error(`MCP tool ${index} missing name: ${JSON.stringify(tool)}`);
    }
    return tool.name;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
