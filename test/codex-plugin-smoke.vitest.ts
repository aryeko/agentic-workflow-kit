import { type ChildProcessWithoutNullStreams, execFileSync, spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import http, { type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const pluginVersion = JSON.parse(readFileSync(path.join(repoRoot, '.codex-plugin/plugin.json'), 'utf8')).version;
const MCP_TIMEOUT_MS = 60_000;

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
    expect(existsSync(path.join(installedRoot, '.mcp.json'))).toBe(false);
    expect(existsSync(path.join(installedRoot, 'mcp/server.mjs'))).toBe(false);
    const installedManifest = JSON.parse(readFileSync(path.join(installedRoot, '.codex-plugin/plugin.json'), 'utf8'));
    const installedMcp = JSON.parse(readFileSync(path.join(installedRoot, installedManifest.mcpServers), 'utf8'));
    expect(installedManifest.mcpServers).toBe('./.codex-plugin/.mcp.json');
    expect(installedMcp.mcpServers?.['agentic-workflow-kit']).toEqual({
      command: 'npx',
      args: ['-y', '--package', `@agentic-workflow-kit/orchestrator@${pluginVersion}`, 'agentic-workflow-kit-mcp'],
    });
    expect(installedMcp.mcpServers?.['agentic-workflow-kit'].args).not.toContain(expect.stringContaining('@latest'));
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
  }, 90_000);

  it('starts the installed package MCP server from a non-plugin consumer cwd', async () => {
    const codexHome = mkdtempSync(path.join(tmpdir(), 'agentic-workflow-kit-codex-home-'));
    const consumerCwd = mkdtempSync(path.join(tmpdir(), 'agentic-workflow-kit-consumer-'));
    mkdirSync(path.join(consumerCwd, '.git'));
    const registry = await createScopedPackageRegistry();
    const npmrc = [`@agentic-workflow-kit:registry=${registry.url}`, 'registry=https://registry.npmjs.org/', ''].join(
      '\n',
    );
    writeFileSync(path.join(consumerCwd, '.npmrc'), npmrc);
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
      command: 'npx',
      args: ['-y', '--package', `@agentic-workflow-kit/orchestrator@${pluginVersion}`, 'agentic-workflow-kit-mcp'],
    });

    const server = spawn(mcpEntry.command, mcpEntry.args, {
      cwd: mcpEntry.cwd === undefined ? consumerCwd : path.resolve(installedRoot, mcpEntry.cwd),
      env: { ...process.env, npm_config_cache: mkdtempSync(path.join(tmpdir(), 'agentic-workflow-kit-npm-cache-')) },
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
      await registry.close();
    }
  }, 30_000);
});

async function createScopedPackageRegistry(): Promise<{ url: string; close: () => Promise<void> }> {
  const packDir = mkdtempSync(path.join(tmpdir(), 'agentic-workflow-kit-pack-'));
  execFileSync('pnpm', ['--filter', '@agentic-workflow-kit/orchestrator', 'pack', '--pack-destination', packDir], {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });
  const tarball = path.join(packDir, `agentic-workflow-kit-orchestrator-${pluginVersion}.tgz`);
  const packageJson = JSON.parse(readFileSync(path.join(repoRoot, 'packages/orchestrator/package.json'), 'utf8'));

  const server = http.createServer((request, response) => {
    const url = request.url ?? '';
    if (url.endsWith('.tgz')) {
      response.writeHead(200, { 'content-type': 'application/octet-stream' });
      createReadStream(tarball).pipe(response);
      return;
    }

    if (url === '/@agentic-workflow-kit%2forchestrator' || url === '/@agentic-workflow-kit%2Forchestrator') {
      const baseUrl = `http://127.0.0.1:${addressPort(server)}`;
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(
        JSON.stringify({
          name: '@agentic-workflow-kit/orchestrator',
          'dist-tags': { latest: pluginVersion },
          versions: {
            [pluginVersion]: {
              name: '@agentic-workflow-kit/orchestrator',
              version: pluginVersion,
              type: packageJson.type,
              bin: packageJson.bin,
              dependencies: packageJson.dependencies,
              dist: {
                tarball: `${baseUrl}/@agentic-workflow-kit/orchestrator/-/agentic-workflow-kit-orchestrator-${pluginVersion}.tgz`,
              },
            },
          },
        }),
      );
      return;
    }

    response.writeHead(404);
    response.end('not found');
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve);
  });

  return {
    url: `http://127.0.0.1:${addressPort(server)}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      });
    },
  };
}

function addressPort(server: Server): number {
  const address = server.address();
  if (address === null || typeof address === 'string') throw new Error('local npm registry did not bind a port');
  return address.port;
}

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
