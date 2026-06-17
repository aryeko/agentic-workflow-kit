import { createHash } from 'node:crypto';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { isRecord, safeName } from '../../internal/guards.js';
import { notifyVerdict } from '../../review/verdictInbox.js';
import type { ReviewVerdict } from '../../types.js';
import type { ChildControlRequest, ChildControlResult } from '../StoryRunner.js';

const SUMMARY_PREVIEW_MAX_LENGTH = 120;

export const REPLY_TOOL_CANDIDATES = ['codex_reply', 'codex-reply', 'reply', 'codex_continue', 'continue'];
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
  message?: string;
  /**
   * Structured pre-PR review verdict. When present, the verdict is deposited
   * (artifact + journal) instead of sending a live reply to the child.
   */
  verdict?: ReviewVerdict;
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

export async function resolveChildControlTarget(input: CodexControlTargetInput): Promise<CodexControlTarget> {
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
  const launch = await readLaunchJson(launchPath);
  if (!isRecord(launch) || typeof launch.sessionId !== 'string' || launch.sessionId.length === 0) {
    throw new Error(`story ${storyId} does not have a linked Codex session`);
  }

  return { sessionId: launch.sessionId, storyId, runPath };
}

async function readLaunchJson(launchPath: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(launchPath, 'utf8')) as unknown;
  } catch (error) {
    if (error instanceof SyntaxError) return null;
    throw error;
  }
}

export const resolveCodexControlTarget = resolveChildControlTarget;

export async function sendChildReply(input: CodexReplyInput): Promise<CodexControlResult> {
  const target = await resolveChildControlTarget(input);
  if (input.verdict) {
    return await depositChildVerdict(target, input.verdict);
  }
  if (!input.message) {
    throw new Error('child reply requires message');
  }
  const result = await callCodexControlTool(REPLY_TOOL_CANDIDATES, {
    sessionId: target.sessionId,
    threadId: target.sessionId,
    message: input.message,
  });
  await journalControlEvent(target, 'child-reply-sent', childReplyJournalFields(input.message, result.tool));
  return { ok: true, ...target, tool: result.tool, rawResult: result.rawResult };
}

/**
 * Deposit a structured pre-PR review verdict for a child waiting in `awaiting_review`.
 * Writes the verdict artifact and journals a redacted `pre_pr_review_verdict` event.
 * Does NOT spawn the live Codex reply tool: in orchestrator mode the supervisor owns
 * the resume turn.
 */
async function depositChildVerdict(target: CodexControlTarget, verdict: ReviewVerdict): Promise<CodexControlResult> {
  if (!target.runPath || !target.storyId) {
    throw new Error('verdict deposit requires runPath and storyId to locate the child verdict artifact');
  }
  const recordedAt = new Date().toISOString();
  const artifact = { ...verdict, recordedAt, sessionId: target.sessionId };
  const artifactPath = path.join(target.runPath, 'children', `${safeName(target.storyId)}.verdict.json`);
  await writeFile(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

  const resumeMessage = verdict.summary ?? `Review verdict: ${verdict.decision}`;
  const summaryPreview =
    typeof verdict.summary === 'string' ? verdict.summary.slice(0, SUMMARY_PREVIEW_MAX_LENGTH) : null;
  await journalControlEvent(target, 'pre_pr_review_verdict', {
    messageSha256: sha256(resumeMessage),
    tool: 'verdict-deposit',
    decision: verdict.decision,
    findingsCount: verdict.findings?.length ?? 0,
    loop: verdict.loop ?? null,
    source: 'reply-tool',
    summaryPreview,
  });

  // In-process fast path: wake a supervisor already awaiting this verdict.
  notifyVerdict(target.runPath, target.storyId, verdict);

  return { ok: true, ...target, tool: 'verdict-deposit', rawResult: artifact };
}

export async function sendChildInterrupt(input: CodexInterruptInput): Promise<CodexControlResult> {
  const target = await resolveChildControlTarget(input);
  const result = await callCodexControlTool(INTERRUPT_TOOL_CANDIDATES, {
    sessionId: target.sessionId,
    threadId: target.sessionId,
    reason: input.reason ?? null,
  });
  await journalControlEvent(target, 'child-interrupt-sent', {
    reason: input.reason ?? null,
    tool: result.tool,
  });
  return { ok: true, ...target, tool: result.tool, rawResult: result.rawResult };
}

export const sendCodexReply = sendChildReply;
export const sendCodexInterrupt = sendChildInterrupt;

export async function controlChild(input: ChildControlRequest): Promise<ChildControlResult> {
  if (input.kind === 'reply') {
    if (!input.message && !input.verdict) throw new Error('child reply requires message or verdict');
    return await sendChildReply(input as CodexReplyInput);
  }
  return await sendChildInterrupt(input as CodexInterruptInput);
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
  type: 'child-reply-sent' | 'child-interrupt-sent' | 'pre_pr_review_verdict',
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

export function codexReplyJournalFields(message: string, tool: string): Record<string, unknown> {
  return childReplyJournalFields(message, tool);
}

export function childReplyJournalFields(message: string, tool: string): Record<string, unknown> {
  return {
    messageSha256: sha256(message),
    tool,
  };
}
