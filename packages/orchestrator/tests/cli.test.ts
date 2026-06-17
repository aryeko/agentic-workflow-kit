import { mkdir, mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import packageJson from '../package.json';
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

async function createRunWorkspace(): Promise<{ root: string; runPath: string }> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-cli-run-surface-'));
  const runPath = path.join(root, '.codex/agentic-workflow-kit/runs/run-1');
  await mkdir(path.join(root, '.workflow'), { recursive: true });
  await mkdir(path.join(root, 'docs/tracks/linkly'), { recursive: true });
  await mkdir(path.join(runPath, 'children'), { recursive: true });
  await writeFile(path.join(root, '.workflow/config.yaml'), 'version: 1\n');
  await writeFile(path.join(root, 'docs/tracks/linkly/README.md'), '# Linkly\n');
  await writeFile(
    path.join(runPath, 'state.json'),
    JSON.stringify({
      runId: 'run-1',
      status: 'complete',
      active: [],
      completed: [{ storyId: 'LK02', ok: true, sessionId: 'thread-1', completedAt: '2026-06-14T00:00:00.000Z' }],
      blockedStoryId: null,
      blockedReason: null,
    }),
  );
  await writeFile(path.join(runPath, 'metrics.live.json'), JSON.stringify({ runId: 'run-1', status: 'complete' }));
  await writeFile(
    path.join(runPath, 'events.ndjson'),
    [
      JSON.stringify({ type: 'run-started', recordedAt: '2026-06-14T00:00:00.000Z' }),
      '{"type":',
      JSON.stringify({ type: 'child-progress', storyId: 'LK02', message: 'testing' }),
    ].join('\n'),
  );
  await writeFile(
    path.join(runPath, 'children/LK02.json'),
    JSON.stringify({ storyId: 'LK02', sessionId: 'thread-1', sessionLogPath: '/tmp/session.jsonl' }),
  );
  return { root, runPath };
}

describe('runCli', () => {
  it('prints runtime version in plain text and JSON formats', async () => {
    const plainStdout: string[] = [];
    const jsonStdout: string[] = [];

    await runCli(['--version'], { stdout: (line) => plainStdout.push(line) });
    await runCli(['version', '--json'], { stdout: (line) => jsonStdout.push(line) });

    expect(plainStdout).toEqual([packageJson.version]);
    expect(JSON.parse(jsonStdout[0])).toMatchObject({
      packageVersion: packageJson.version,
      apiVersion: '1',
      mcpServer: { name: 'agentic-workflow-kit', version: packageJson.version },
      configSchema: { current: '0.7.0', minimumSupported: '0.6.0' },
    });
  });

  it('prints config status and previews/applies config upgrade', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-config-cli-'));
    await mkdir(path.join(root, '.workflow'), { recursive: true });
    await writeFile(
      path.join(root, '.workflow/config.yaml'),
      ['version: 1', 'paths:', '  tracksDir: docs/work', ''].join('\n'),
    );
    const statusStdout: string[] = [];
    const dryRunStdout: string[] = [];
    const upgradeStdout: string[] = [];

    await runCli(['config', 'status', '--cwd', root, '--json'], { stdout: (line) => statusStdout.push(line) });
    await runCli(['config', 'upgrade', '--cwd', root, '--dry-run', '--json'], {
      stdout: (line) => dryRunStdout.push(line),
    });
    expect(await readFile(path.join(root, '.workflow/config.yaml'), 'utf8')).toContain('version: 1');
    await runCli(['config', 'upgrade', '--cwd', root, '--yes', '--json'], {
      stdout: (line) => upgradeStdout.push(line),
    });

    expect(JSON.parse(statusStdout[0])).toMatchObject({
      status: 'legacy-upgradeable',
      detectedVersion: '1',
      targetVersion: '0.7.0',
      upgradeAvailable: true,
      blocking: false,
    });
    expect(JSON.parse(dryRunStdout[0])).toMatchObject({
      dryRun: true,
      wrote: false,
      changes: [{ path: 'version', from: 1, to: '0.7.0' }],
    });
    expect(JSON.parse(upgradeStdout[0])).toMatchObject({
      dryRun: false,
      wrote: true,
      targetVersion: '0.7.0',
    });
    expect(await readFile(path.join(root, '.workflow/config.yaml'), 'utf8')).toContain('version: 0.7.0');
    expect(await readFile(path.join(root, '.workflow/config.yaml'), 'utf8')).toContain('tracksDir: docs/work');
  });

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

  it('prints product run status, stream, and inspect outputs', async () => {
    const previousExitCode = process.exitCode;
    const { root, runPath } = await createRunWorkspace();
    const statusStdout: string[] = [];
    const streamStdout: string[] = [];
    const inspectStdout: string[] = [];

    try {
      process.exitCode = undefined;
      await runCli(['run', 'status', 'run-1', '--cwd', root], { stdout: (line) => statusStdout.push(line) });
      await runCli(['run', 'stream', 'run-1', '--cwd', root, '--format', 'ndjson'], {
        stdout: (line) => streamStdout.push(line),
      });
      await runCli(['run', 'inspect', runPath], { stdout: (line) => inspectStdout.push(line) });

      expect(JSON.parse(statusStdout[0])).toMatchObject({
        ok: true,
        operation: 'workflow_run_status',
        result: { runId: 'run-1', status: 'complete' },
      });
      expect(streamStdout.map((line) => JSON.parse(line))).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'child-progress', topic: 'child' })]),
      );
      expect(JSON.parse(inspectStdout[0])).toMatchObject({
        ok: true,
        operation: 'workflow_run_inspect',
        result: { children: [expect.objectContaining({ storyId: 'LK02', sessionId: 'thread-1' })] },
      });
      expect(process.exitCode).toBeUndefined();
    } finally {
      process.exitCode = previousExitCode;
    }
  });

  it('prints detached subscription lifecycle outputs', async () => {
    const previousExitCode = process.exitCode;
    const { root, runPath } = await createRunWorkspace();
    const subscribeStdout: string[] = [];
    const pollStdout: string[] = [];
    const unsubscribeStdout: string[] = [];

    try {
      process.exitCode = undefined;
      await runCli(['run', 'subscribe', 'run-1', '--cwd', root, '--topics', 'pr'], {
        stdout: (line) => subscribeStdout.push(line),
      });
      const subscribed = JSON.parse(subscribeStdout[0]) as {
        result: { subscriptionId: string; nextCursor: string };
      };

      await runCli(
        [
          'run',
          'subscription-poll',
          runPath,
          subscribed.result.subscriptionId,
          '--ack-cursor',
          subscribed.result.nextCursor,
        ],
        { stdout: (line) => pollStdout.push(line) },
      );
      await runCli(['run', 'unsubscribe', runPath, subscribed.result.subscriptionId], {
        stdout: (line) => unsubscribeStdout.push(line),
      });

      expect(JSON.parse(subscribeStdout[0])).toMatchObject({
        ok: true,
        operation: 'workflow_run_subscribe',
        result: { runId: 'run-1', committedCursor: 'events.ndjson:0', replay: [] },
      });
      expect(JSON.parse(pollStdout[0])).toMatchObject({
        ok: true,
        operation: 'workflow_run_subscription_poll',
        warnings: [{ code: 'CONFIG_UNAVAILABLE' }],
        result: { subscriptionId: subscribed.result.subscriptionId, events: [] },
      });
      expect(JSON.parse(unsubscribeStdout[0])).toMatchObject({
        ok: true,
        operation: 'workflow_run_unsubscribe',
        warnings: [{ code: 'CONFIG_UNAVAILABLE' }],
        result: { subscriptionId: subscribed.result.subscriptionId, closed: true },
      });
      expect(process.exitCode).toBeUndefined();
    } finally {
      process.exitCode = previousExitCode;
    }
  });
});
