import { type ChildProcessWithoutNullStreams, execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const repoRoot = process.cwd();
const orchestratorDist = path.join(repoRoot, 'packages/orchestrator/dist');
const orchestratorVersion = JSON.parse(
  readFileSync(path.join(repoRoot, 'packages/orchestrator/package.json'), 'utf8'),
).version;
const orchestratorTarball = `agentic-workflow-kit-orchestrator-${orchestratorVersion}.tgz`;
const MCP_TIMEOUT_MS = 10_000;

function removeDist(): void {
  rmSync(orchestratorDist, { recursive: true, force: true });
}

function run(command: string, args: string[]): string {
  return execFileSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
    stdio: 'pipe',
  });
}

describe.sequential('publish readiness smoke', () => {
  beforeEach(() => {
    removeDist();
  });

  it('builds a runnable package entrypoint and CLI', () => {
    run('pnpm', ['build']);

    const help = run('node', ['packages/orchestrator/dist/cli.js', '--help']);
    expect(help).toContain('agentic-workflow-kit');
    expect(help).toContain('list-tracks');

    const orchestrator = run('node', [
      '-e',
      "import('./packages/orchestrator/dist/index.js').then(() => console.log('orchestrator ok'))",
    ]);
    expect(orchestrator.trim()).toBe('orchestrator ok');
  }, 120_000);

  it('builds a runnable package MCP entrypoint', async () => {
    run('pnpm', ['--filter', '@agentic-workflow-kit/orchestrator', 'build']);

    const server = spawn(process.execPath, ['packages/orchestrator/dist/mcp/server.js'], {
      cwd: repoRoot,
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
          clientInfo: { name: 'agentic-workflow-kit-package-smoke', version: '1.0.0' },
        },
      });
      session.notify({ jsonrpc: '2.0', method: 'notifications/initialized' });

      const result = await session.request({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {},
      });

      expect(readToolNames(result)).toEqual(expect.arrayContaining(['list_eligible', 'run_story']));
    } finally {
      server.kill();
    }
  }, 120_000);

  it('builds before packing from a fresh state', () => {
    const output = run('pnpm', ['pack:dry-run']);

    expect(output).toContain(orchestratorTarball);
    expect(output).toContain('dist/index.js');
    expect(output).toContain('dist/cli.js');
    expect(output).toContain('dist/mcp/server.js');
  }, 120_000);

  it('raw package pack command builds a publishable tarball from a fresh state', () => {
    const destination = mkdtempSync(path.join(tmpdir(), 'agentic-workflow-kit-pack-'));

    run('pnpm', ['--filter', '@agentic-workflow-kit/orchestrator', 'pack', '--pack-destination', destination]);
    const orchestratorContents = run('tar', ['-tf', path.join(destination, orchestratorTarball)]);

    expect(orchestratorContents).toContain('package/dist/index.js');
    expect(orchestratorContents).toContain('package/dist/cli.js');
    expect(orchestratorContents).toContain('package/dist/mcp/server.js');
    expect(orchestratorContents).toContain('package/dist/index.d.ts');
    const packageJson = run('tar', ['-xOf', path.join(destination, orchestratorTarball), 'package/package.json']);
    expect(JSON.parse(packageJson).bin).toMatchObject({
      'agentic-workflow-kit': './dist/cli.js',
      'agentic-workflow-kit-mcp': './dist/mcp/server.js',
    });
  }, 120_000);

  it('keeps the root agentic-workflow-kit dev command working without dist', () => {
    const help = run('pnpm', ['agentic-workflow-kit', '--', '--help']);
    expect(help).toContain('agentic-workflow-kit');
    expect(help).toContain('list-tracks');
  }, 120_000);
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
