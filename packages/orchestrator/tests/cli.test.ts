import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises';
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

  it('sets a nonzero exit code when tracker validation reports errors', async () => {
    const previousExitCode = process.exitCode;
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-cli-validate-'));
    const stdout: string[] = [];
    await mkdir(path.join(root, '.workflow'), { recursive: true });
    await mkdir(path.join(root, 'docs/tracks/linkly'), { recursive: true });
    await writeFile(path.join(root, '.workflow/config.yaml'), 'version: 1\n');
    await writeFile(
      path.join(root, 'docs/tracks/linkly/README.md'),
      [
        '# Linkly',
        '',
        '| ID | Name | Depends on | Wave | Status | Spec | Plan | Owner | PR |',
        '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
        '| LK01 | Foundation | — | 1 | done | [brief](./stories/LK01.md) | — | — | — |',
        '| ZZ02 | Bad prefix | LK01 | 2 | specced | [brief](./stories/ZZ02.md) | — | — | — |',
      ].join('\n'),
    );

    try {
      process.exitCode = undefined;
      await runCli(['tracker', 'validate', '--cwd', root, '--track', 'linkly'], {
        stdout: (line) => stdout.push(line),
      });

      expect(process.exitCode).toBe(1);
      expect(JSON.parse(stdout[0])).toMatchObject({
        ok: true,
        result: { report: { ok: false } },
      });
    } finally {
      process.exitCode = previousExitCode;
    }
  });
});
