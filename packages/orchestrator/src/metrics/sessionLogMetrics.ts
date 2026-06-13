import { readFile } from 'node:fs/promises';

import { isRecord } from '../internal/guards.js';
import type { TokenTotals } from '../types.js';

export interface SessionLogMetrics {
  commandCounts: Record<string, number>;
  subagentCounts: Record<string, number>;
  tokenTotals: TokenTotals | null;
  reviewLoops: SessionReviewLoop[];
  failedSpawnAgentAttempts: number;
}

export interface SessionReviewLoop {
  loop: number | null;
  mode: string | null;
  status: string;
  findings: number | null;
  agentId: string | null;
  previousAgentId: string | null;
  continuityMode: string | null;
}

export async function mapSessionLogsByThread(sessionLogs: string[]): Promise<Map<string, string>> {
  const byThread = new Map<string, string>();
  for (const sessionLog of sessionLogs) {
    const content = await readFile(sessionLog, 'utf8');
    for (const line of content.split('\n')) {
      const entry = parseJsonLine(line);
      if (entry?.type !== 'session_meta' || !isRecord(entry.payload)) continue;
      const id = entry.payload.id;
      if (typeof id === 'string' && !byThread.has(id)) {
        byThread.set(id, sessionLog);
      }
    }
  }
  return byThread;
}

export async function analyzeSessionLogMetrics(sessionLog: string): Promise<SessionLogMetrics> {
  const commandCounts: Record<string, number> = {};
  const subagentCounts: Record<string, number> = {};
  let tokenTotals: TokenTotals | null = null;
  const reviewState = new SessionReviewState();

  const content = await readFile(sessionLog, 'utf8');
  for (const line of content.split('\n')) {
    const entry = parseJsonLine(line);
    if (!entry || !isRecord(entry.payload)) continue;

    if (entry.type === 'response_item' && isRecord(entry.payload)) {
      const payload = entry.payload;
      if (
        (payload.type === 'function_call' || payload.type === 'custom_tool_call') &&
        typeof payload.name === 'string'
      ) {
        increment(commandCounts, payload.name);
      }
      if (payload.type === 'function_call' && payload.name === 'spawn_agent' && typeof payload.arguments === 'string') {
        const parsedArgs = parseJsonLine(payload.arguments);
        if (parsedArgs && typeof parsedArgs.agent_type === 'string') {
          increment(subagentCounts, parsedArgs.agent_type);
        }
      }
      if (payload.type === 'function_call' && typeof payload.name === 'string' && typeof payload.call_id === 'string') {
        reviewState.recordCall(payload.call_id, payload.name, readOptionalString(payload.arguments));
      }
      if (payload.type === 'function_call_output' && typeof payload.call_id === 'string') {
        reviewState.recordOutput(payload.call_id, readOptionalString(payload.output));
      }
    }

    if (entry.type === 'event_msg' && entry.payload.type === 'token_count' && isRecord(entry.payload.info)) {
      const usage = entry.payload.info.total_token_usage;
      if (isRecord(usage)) {
        tokenTotals = {
          inputTokens: readNumber(usage.input_tokens),
          cachedInputTokens: readNumber(usage.cached_input_tokens),
          outputTokens: readNumber(usage.output_tokens),
          reasoningOutputTokens: readNumber(usage.reasoning_output_tokens),
          totalTokens: readNumber(usage.total_tokens),
        };
      }
    }
  }

  return {
    commandCounts,
    subagentCounts,
    tokenTotals,
    reviewLoops: reviewState.loops(),
    failedSpawnAgentAttempts: reviewState.failedSpawnAgentAttempts(),
  };
}

class SessionReviewState {
  private readonly calls = new Map<string, { name: string; args: Record<string, unknown> | null }>();
  private readonly reviewAgents = new Set<string>();
  private readonly reviewLoops: SessionReviewLoop[] = [];
  private readonly seenResults = new Set<string>();
  private failedSpawns = 0;

  recordCall(callId: string, name: string, rawArgs: string | null): void {
    this.calls.set(callId, { name, args: rawArgs ? parseJsonLine(rawArgs) : null });
  }

  recordOutput(callId: string, rawOutput: string | null): void {
    const call = this.calls.get(callId);
    if (!call || rawOutput === null) return;

    if (call.name === 'spawn_agent') {
      const prompt = readOptionalString(call.args?.message) ?? readOptionalString(call.args?.prompt) ?? '';
      const output = parseLooseJsonObject(rawOutput);
      const agentId = readOptionalString(output?.agent_path) ?? readOptionalString(output?.target);
      if (!agentId && /error|failed|invalid|provide either/i.test(rawOutput)) {
        this.failedSpawns += 1;
      }
      if (agentId && isReviewText(prompt)) this.reviewAgents.add(agentId);
      return;
    }

    if (call.name !== 'wait_agent' && call.name !== 'close_agent') return;
    const output = parseLooseJsonObject(rawOutput);
    for (const target of callTargets(call.args)) {
      const summary = extractCompletedText(output, target) ?? rawOutput;
      if (!target || (!this.reviewAgents.has(target) && !isReviewText(summary))) continue;
      const findings = countFindingsFromText(summary);
      if (findings === null) continue;
      const status = findings > 0 ? 'findings' : 'passed';
      const resultKey = `${target}:${status}:${findings}:${summary.trim()}`;
      if (this.seenResults.has(resultKey)) continue;
      this.seenResults.add(resultKey);
      this.reviewLoops.push({
        loop: this.reviewLoops.length + 1,
        mode: 'subagent',
        status,
        findings,
        agentId: target,
        previousAgentId: null,
        continuityMode: null,
      });
    }
  }

  loops(): SessionReviewLoop[] {
    return this.reviewLoops;
  }

  failedSpawnAgentAttempts(): number {
    return this.failedSpawns;
  }
}

function parseLooseJsonObject(value: string): Record<string, unknown> | null {
  const parsed = parseJsonLine(value);
  return isRecord(parsed) ? parsed : null;
}

function callTargets(args: Record<string, unknown> | null): string[] {
  const target = readOptionalString(args?.target);
  if (target) return [target];
  return Array.isArray(args?.targets) ? args.targets.filter((entry): entry is string => typeof entry === 'string') : [];
}

function extractCompletedText(value: Record<string, unknown> | null, target?: string): string | null {
  const status = readRecord(value?.status) ?? readRecord(value?.previous_status);
  const targetStatus = target ? readRecord(status?.[target]) : null;
  return (
    readOptionalString(targetStatus?.completed) ??
    readOptionalString(status?.completed) ??
    readOptionalString(value?.completed)
  );
}

function isReviewText(value: string): boolean {
  return /pre[-_ ]pr|pre[-_ ]pull|review|findings/i.test(value);
}

function countFindingsFromText(value: string): number | null {
  if (/no findings|no actionable findings/i.test(value)) return 0;
  if (!/findings/i.test(value)) return null;
  const bulletCount = findingsSection(value).filter((line) => /^\s*-\s+/.test(line)).length;
  return bulletCount > 0 ? bulletCount : null;
}

function findingsSection(value: string): string[] {
  const lines = value.split('\n');
  const headingIndex = lines.findIndex((line) => /findings/i.test(line));
  if (headingIndex === -1) return lines;
  const section: string[] = [];
  for (const line of lines.slice(headingIndex + 1)) {
    if (/^\s*\*{0,2}[A-Z][A-Za-z ]+\*{0,2}\s*$/.test(line) && !/^\s*-/.test(line)) break;
    section.push(line);
  }
  return section;
}

function parseJsonLine(line: string): Record<string, unknown> | null {
  if (line.trim().length === 0) return null;
  try {
    const parsed = JSON.parse(line) as unknown;
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function increment(target: Record<string, number>, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}

function readNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function readOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}
