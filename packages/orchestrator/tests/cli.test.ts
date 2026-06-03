import { mkdtemp, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

import { isDirectCliExecution, runCli } from '../src/cli';

class FakeClient {
  closed = false;
  connectedCwd: string | undefined;

  async connect(transport: { cwd?: string }): Promise<void> {
    this.connectedCwd = transport.cwd;
  }

  async listTools(): Promise<unknown> {
    return {
      tools: [
        {
          name: 'codex',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: { type: 'string' },
              model: { type: 'string' },
              config: { type: 'object' },
              'approval-policy': { enum: ['never', 'on-failure', 'on-request', 'untrusted'] },
              sandbox: { enum: ['danger-full-access', 'read-only', 'workspace-write'] },
            },
          },
        },
      ],
    };
  }

  async close(): Promise<void> {
    this.closed = true;
  }
}

describe('runCli', () => {
  it('runs mcp check with only a cwd when no workflow config exists', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-mcp-check-'));
    const client = new FakeClient();
    const stdout: string[] = [];

    await runCli(['mcp', 'check', '--cwd', root, '--json'], {
      stdout: (line) => stdout.push(line),
      createCodexMcpClient: () => ({ client: client as never, transport: { cwd: root } as never }),
    });

    expect(client.connectedCwd).toBe(root);
    expect(client.closed).toBe(true);
    expect(JSON.parse(stdout[0])).toEqual({ ok: true, tools: ['codex'] });
  });

  it('detects direct CLI execution through a package-bin symlink', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-cli-entry-'));
    const target = path.join(root, 'dist-cli.js');
    const bin = path.join(root, 'agentic-workflow-kit');
    await writeFile(target, '');
    await symlink(target, bin);

    expect(isDirectCliExecution(bin, pathToFileURL(target).href)).toBe(true);
  });
});
