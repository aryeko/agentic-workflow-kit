import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  calls: [] as Array<{ name: string; arguments: Record<string, unknown> }>,
  closes: 0,
  connects: 0,
  tools: [] as string[],
  transports: [] as Array<{ command: string; args: string[]; stderr: string }>,
}));

vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: class {
    async connect(): Promise<void> {
      mocks.connects += 1;
    }

    async listTools(): Promise<{ tools: Array<{ name: string }> }> {
      return { tools: mocks.tools.map((name) => ({ name })) };
    }

    async callTool(input: { name: string; arguments?: Record<string, unknown> }): Promise<Record<string, unknown>> {
      mocks.calls.push({ name: input.name, arguments: input.arguments ?? {} });
      return { ok: true, tool: input.name };
    }

    async close(): Promise<void> {
      mocks.closes += 1;
    }
  },
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: class {
    constructor(options: { command: string; args: string[]; stderr: string }) {
      mocks.transports.push(options);
    }
  },
}));

const tempRoots: string[] = [];

beforeEach(() => {
  mocks.calls = [];
  mocks.closes = 0;
  mocks.connects = 0;
  mocks.tools = [];
  mocks.transports = [];
});

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function tempRunPath(): Promise<string> {
  const runPath = await mkdtemp(path.join(tmpdir(), 'awk-control-exec-'));
  tempRoots.push(runPath);
  await mkdir(path.join(runPath, 'children'), { recursive: true });
  return runPath;
}

async function readEvents(runPath: string): Promise<Array<Record<string, unknown>>> {
  return (await readFile(path.join(runPath, 'events.ndjson'), 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe('Codex child-control execution', () => {
  it('sends replies through an available Codex MCP tool and journals only a message hash', async () => {
    const { sendChildReply } = await import('../src/drivers/codex-mcp/control');
    const runPath = await tempRunPath();
    mocks.tools = ['codex_reply'];

    const result = await sendChildReply({
      sessionId: '019e-session',
      storyId: 'WK001',
      runPath,
      message: 'secret token sk-live-123',
    });

    expect(result).toMatchObject({
      ok: true,
      tool: 'codex_reply',
      sessionId: '019e-session',
      storyId: 'WK001',
      runPath,
    });
    expect(mocks.transports).toEqual([{ command: 'codex', args: ['mcp-server'], stderr: 'inherit' }]);
    expect(mocks.connects).toBe(1);
    expect(mocks.closes).toBe(1);
    expect(mocks.calls).toEqual([
      {
        name: 'codex_reply',
        arguments: {
          sessionId: '019e-session',
          threadId: '019e-session',
          message: 'secret token sk-live-123',
        },
      },
    ]);

    const [event] = await readEvents(runPath);
    expect(event).toMatchObject({
      type: 'child-reply-sent',
      storyId: 'WK001',
      sessionId: '019e-session',
      tool: 'codex_reply',
      messageSha256: '3fb49f5289846a39350df3f09b5f9e64e06473dc56143fdbe82d68ca6c850a6a',
    });
    expect(JSON.stringify(event)).not.toContain('secret token');
    expect(JSON.stringify(event)).not.toContain('sk-live');
  });

  it('sends interrupts through an available Codex MCP tool and journals the reason', async () => {
    const { sendChildInterrupt } = await import('../src/drivers/codex-mcp/control');
    const runPath = await tempRunPath();
    mocks.tools = ['codex_interrupt'];

    const result = await sendChildInterrupt({
      sessionId: '019e-session',
      storyId: 'WK001',
      runPath,
      reason: 'operator stop',
    });

    expect(result).toMatchObject({
      ok: true,
      tool: 'codex_interrupt',
      sessionId: '019e-session',
      storyId: 'WK001',
      runPath,
    });
    expect(mocks.calls).toEqual([
      {
        name: 'codex_interrupt',
        arguments: {
          sessionId: '019e-session',
          threadId: '019e-session',
          reason: 'operator stop',
        },
      },
    ]);

    await expect(readEvents(runPath)).resolves.toMatchObject([
      {
        type: 'child-interrupt-sent',
        storyId: 'WK001',
        sessionId: '019e-session',
        tool: 'codex_interrupt',
        reason: 'operator stop',
      },
    ]);
  });

  it('dispatches neutral child-control requests through reply and interrupt execution paths', async () => {
    const { controlChild } = await import('../src/drivers/codex-mcp/control');
    mocks.tools = ['codex_reply', 'codex_interrupt'];

    await controlChild({ kind: 'reply', sessionId: '019e-session', message: 'continue' });
    await controlChild({ kind: 'interrupt', sessionId: '019e-session', reason: 'stop' });

    expect(mocks.calls).toEqual([
      {
        name: 'codex_reply',
        arguments: { sessionId: '019e-session', threadId: '019e-session', message: 'continue' },
      },
      {
        name: 'codex_interrupt',
        arguments: { sessionId: '019e-session', threadId: '019e-session', reason: 'stop' },
      },
    ]);
  });
});
