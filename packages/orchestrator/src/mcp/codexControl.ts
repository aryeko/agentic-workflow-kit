import { createHash } from 'node:crypto';
import { appendFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

import { isRecord, safeName } from '../internal/guards.js';

const REPLY_TOOL_CANDIDATES = ['codex_reply', 'codex-reply', 'reply', 'codex_continue', 'continue'];
const INTERRUPT_TOOL_CANDIDATES = ['codex_interrupt', 'codex-interrupt', 'interrupt', 'codex_cancel', 'cancel'];

export interface CodexControlTargetInput {
  sessionId?: string;
  runPath?: string;
  storyId?: string;
}

export interface CodexControlTarget {
  sessionId: string;
  storyId: string | null;
  runPath: string | null;
}

export interface CodexReplyInput extends CodexControlTargetInput {
  message: string;
}

export interface CodexInterruptInput extends CodexControlTargetInput {
  reason?: string;
}

export interface CodexControlResult {
  ok: true;
  tool: string;
  sessionId: string;
  storyId: string | null;
  runPath: string | null;
  rawResult: unknown;
}

export async function resolveCodexControlTarget(input: CodexControlTargetInput): Promise<CodexControlTarget> {
  if (input.sessionId && input.sessionId.trim().length > 0) {
    return {
      sessionId: input.sessionId,
      storyId: input.storyId ?? null,
      runPath: input.runPath ? path.resolve(input.runPath) : null,
    };
  }

  if (!input.runPath || !input.storyId) {
    throw new Error('codex control requires either sessionId or runPath plus storyId');
  }

  const runPath = path.resolve(input.runPath);
  const storyId = input.storyId;
  const launchPath = path.join(runPath, 'children', `${safeName(storyId)}.launch.json`);
  const launch = JSON.parse(await readFile(launchPath, 'utf8')) as unknown;
  if (!isRecord(launch) || typeof launch.sessionId !== 'string' || launch.sessionId.length === 0) {
    throw new Error(`story ${storyId} does not have a linked Codex session`);
  }

  return { sessionId: launch.sessionId, storyId, runPath };
}

export async function sendCodexReply(input: CodexReplyInput): Promise<CodexControlResult> {
  const target = await resolveCodexControlTarget(input);
  const result = await callCodexControlTool(REPLY_TOOL_CANDIDATES, {
    sessionId: target.sessionId,
    threadId: target.sessionId,
    message: input.message,
  });
  await journalControlEvent(target, 'codex-reply-sent', {
    messagePreview: input.message.slice(0, 200),
    messageSha256: sha256(input.message),
    tool: result.tool,
  });
  return { ok: true, ...target, tool: result.tool, rawResult: result.rawResult };
}

export async function sendCodexInterrupt(input: CodexInterruptInput): Promise<CodexControlResult> {
  const target = await resolveCodexControlTarget(input);
  const result = await callCodexControlTool(INTERRUPT_TOOL_CANDIDATES, {
    sessionId: target.sessionId,
    threadId: target.sessionId,
    reason: input.reason ?? null,
  });
  await journalControlEvent(target, 'codex-interrupt-sent', {
    reason: input.reason ?? null,
    tool: result.tool,
  });
  return { ok: true, ...target, tool: result.tool, rawResult: result.rawResult };
}

async function callCodexControlTool(
  candidates: string[],
  args: Record<string, unknown>,
): Promise<{ tool: string; rawResult: unknown }> {
  const client = new Client({ name: 'agentic-workflow-kit-control', version: '0.1.0' });
  const transport = new StdioClientTransport({
    command: 'codex',
    args: ['mcp-server'],
    stderr: 'inherit',
  });
  try {
    await client.connect(transport);
    const list = await client.listTools({}, { timeout: 10_000, maxTotalTimeout: 10_000 });
    const tools = Array.isArray(list.tools) ? list.tools : [];
    const names = new Set(
      tools
        .map((tool) => (isRecord(tool) && typeof tool.name === 'string' ? tool.name : null))
        .filter((name): name is string => name !== null),
    );
    const tool = candidates.find((candidate) => names.has(candidate));
    if (!tool) throw new Error(`Codex MCP control tool ${candidates[0]} is unavailable`);
    const rawResult = await client.callTool({ name: tool, arguments: args }, undefined, {
      timeout: 30_000,
      maxTotalTimeout: 30_000,
    });
    return { tool, rawResult };
  } finally {
    await client.close();
  }
}

async function journalControlEvent(
  target: CodexControlTarget,
  type: 'codex-reply-sent' | 'codex-interrupt-sent',
  fields: Record<string, unknown>,
): Promise<void> {
  if (!target.runPath) return;
  const now = new Date().toISOString();
  const event = {
    ...fields,
    storyId: target.storyId,
    sessionId: target.sessionId,
    recordedAt: now,
    eventAt: now,
    type,
  };
  await appendFile(path.join(target.runPath, 'events.ndjson'), `${JSON.stringify(event)}\n`);
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
