#!/usr/bin/env node

import { createReadStream } from 'node:fs';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const usage = `Usage: node scripts/import-session-observability.mjs --session-jsonl <path> [options]

Import a Codex/agent session JSONL into normalized delivery observability
events. This is a backfill adapter for older runs; future delivery workflows
should record the normalized events directly.

Options:
  --session-jsonl <path>  Codex/agent session JSONL path
  --output <path>         Write normalized events JSONL to this path
  --run-id <id>           Stable run id to put on every event
  --format <jsonl|json>   Output format (default: jsonl)
  --help                  Show this help
`;

const ok = (value) => value !== null && value !== undefined && value !== '';

const parseArgs = (argv) => {
  const options = { format: 'jsonl' };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') {
      return { ...options, help: true };
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }

    if (arg === '--session-jsonl') {
      options.sessionJsonl = value;
    } else if (arg === '--output') {
      options.output = value;
    } else if (arg === '--run-id') {
      options.runId = value;
    } else if (arg === '--format') {
      options.format = value;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }

    index += 1;
  }

  if (!['jsonl', 'json'].includes(options.format)) {
    throw new Error(`Unsupported --format ${options.format}; expected jsonl or json`);
  }

  if (!options.help && !options.sessionJsonl) {
    throw new Error('Missing required --session-jsonl path');
  }

  return options;
};

const fileExists = async (candidate) => {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
};

const parseJsonMaybe = (value) => {
  if (!ok(value)) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const textFromMessageContent = (content) =>
  Array.isArray(content)
    ? content.map((part) => part.text ?? part.input_text ?? part.output_text ?? '').join('\n')
    : '';

const extractAliasFromMessage = (message) =>
  typeof message === 'string' ? message.match(/(?:^|\n)\s*Alias:\s*([a-z0-9_.:-]+)/i)?.[1]?.trim() : null;

const extractStoryIdFromMessage = (message) => {
  if (typeof message !== 'string') {
    return null;
  }

  return (
    message.match(/Task:\s*implement\s*`([^`]+)`/i)?.[1]?.trim() ??
    message.match(/Scope under review:\s*`([^`]+)`/i)?.[1]?.trim() ??
    message.match(/(prov-\d+-s\d+-[a-z0-9-]+)/i)?.[1]?.trim() ??
    null
  );
};

const roleFromMessage = (message) => {
  const text = String(message ?? '');
  if (
    /^\s*review\b/i.test(text) ||
    /you are (the )?independent reviewer/i.test(text) ||
    /scope under review/i.test(text)
  ) {
    return 'reviewer';
  }
  if (/task:\s*implement\b/i.test(text) || /you are implementing\b/i.test(text)) {
    return 'implementer';
  }
  return /\breview\b/i.test(text) ? 'reviewer' : 'implementer';
};

const classifyFinding = (text) => {
  const lowered = String(text ?? '').toLowerCase();
  if (lowered.includes('ac-') || lowered.includes('acceptance')) {
    return 'ac-miss';
  }
  if (lowered.includes('pathset') || lowered.includes('scope')) {
    return 'scope-pathset';
  }
  if (lowered.includes('gate') || lowered.includes('evidence')) {
    return 'gate-evidence';
  }
  if (lowered.includes('spec gap') || lowered.includes('characterization')) {
    return 'spec-gap';
  }
  if (lowered.includes('ci') || lowered.includes('pr review')) {
    return 'ci-pr-review';
  }
  if (lowered.includes('race') || lowered.includes('leak') || lowered.includes('fail-open')) {
    return 'bucket2';
  }
  return 'other';
};

const extractFindings = (text) => {
  const findings = [];
  for (const match of String(text ?? '').matchAll(/\*\*(High|Medium|Low|P\d):\*\*\s*([^\n]+)/gi)) {
    findings.push({
      severity: match[1].toLowerCase(),
      class: classifyFinding(match[2]),
      summary: match[2].trim(),
    });
  }
  return findings;
};

const verdictFromText = (text) => {
  const trimmed = String(text ?? '').trim();
  if (/^APPROVED\b/i.test(trimmed)) {
    return 'approved';
  }
  if (/^CHANGES_REQUESTED\b/i.test(trimmed)) {
    return 'changes_requested';
  }
  return null;
};

const tokenUsageFromRecord = (record) => {
  const usage = record?.payload?.info?.total_token_usage;
  if (!usage || typeof usage !== 'object') {
    return null;
  }

  return {
    input: usage.input_tokens ?? usage.input ?? 0,
    cachedInput: usage.cached_input_tokens ?? usage.cachedInput ?? 0,
    output: usage.output_tokens ?? usage.output ?? 0,
    reasoning: usage.reasoning_output_tokens ?? usage.reasoning ?? 0,
    total: usage.total_tokens ?? usage.total ?? 0,
  };
};

const eventBase = ({ record, sessionJsonl, runId, sequence }) => ({
  version: 1,
  sequence,
  runId,
  timestamp: record.timestamp ?? null,
  source: {
    kind: 'codex-session-jsonl',
    path: sessionJsonl,
    confidence: 'observed',
  },
});

export const importSessionObservability = async (options) => {
  const sessionJsonl = path.resolve(options.sessionJsonl);
  if (!(await fileExists(sessionJsonl))) {
    throw new Error(`Session JSONL not found: ${sessionJsonl}`);
  }

  const runId = options.runId ?? path.basename(sessionJsonl, '.jsonl');
  const events = [];
  const pendingSpawns = new Map();
  const workersByAgentId = new Map();
  let sequence = 0;
  let turnIndex = 0;
  let invalidJsonLines = 0;
  let inspectedLines = 0;

  const append = (event) => {
    sequence += 1;
    events.push({ ...event, sequence });
  };

  const lines = readline.createInterface({
    input: createReadStream(sessionJsonl, { encoding: 'utf8' }),
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  for await (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    inspectedLines += 1;
    const record = parseJsonMaybe(trimmed);
    if (!record) {
      invalidJsonLines += 1;
      continue;
    }

    const payload = record.payload;

    if (payload?.type === 'message' && ['user', 'assistant'].includes(payload.role)) {
      turnIndex += 1;
      append({
        ...eventBase({ record, sessionJsonl, runId, sequence }),
        type: 'turn_observed',
        turnIndex,
        role: payload.role,
        textLength: textFromMessageContent(payload.content).length,
      });
    }

    if (record.type === 'event_msg' && payload?.type === 'token_count') {
      const usage = tokenUsageFromRecord(record);
      if (usage) {
        append({
          ...eventBase({ record, sessionJsonl, runId, sequence }),
          type: 'token_usage_observed',
          scope: { type: 'session', id: runId },
          usage,
        });
      }
    }

    if (payload?.type === 'function_call' && payload.name === 'spawn_agent') {
      const spawnArgs = parseJsonMaybe(payload.arguments) ?? {};
      const worker = {
        alias: spawnArgs.alias ?? spawnArgs.worker_alias ?? extractAliasFromMessage(spawnArgs.message),
        storyId: spawnArgs.storyId ?? spawnArgs.story_id ?? extractStoryIdFromMessage(spawnArgs.message),
        role: roleFromMessage(spawnArgs.message),
        model: spawnArgs.model ?? null,
        effort: spawnArgs.reasoning_effort ?? null,
      };
      pendingSpawns.set(payload.call_id, { worker, record });
    }

    if (payload?.type === 'function_call_output') {
      const output = parseJsonMaybe(payload.output);
      if (output?.agent_id && pendingSpawns.has(payload.call_id)) {
        const spawn = pendingSpawns.get(payload.call_id);
        const worker = {
          ...spawn.worker,
          agentId: output.agent_id,
          nickname: output.nickname ?? null,
        };
        workersByAgentId.set(output.agent_id, worker);
        append({
          ...eventBase({ record, sessionJsonl, runId, sequence }),
          type: 'worker_spawned',
          worker,
        });
      }

      if (output?.status && typeof output.status === 'object') {
        for (const [agentId, status] of Object.entries(output.status)) {
          const completedText = status.completed ?? status.failed ?? status.cancelled ?? '';
          if (!completedText) {
            continue;
          }

          const worker = workersByAgentId.get(agentId) ?? { agentId };
          append({
            ...eventBase({ record, sessionJsonl, runId, sequence }),
            type: 'worker_completed',
            worker,
            status: status.completed ? 'completed' : status.failed ? 'failed' : 'cancelled',
            summary: String(completedText).replace(/\s+/g, ' ').trim().slice(0, 500),
          });

          const verdict = verdictFromText(completedText);
          if (verdict) {
            append({
              ...eventBase({ record, sessionJsonl, runId, sequence }),
              type: 'review_completed',
              worker,
              storyId: worker.storyId ?? null,
              verdict,
              findings: extractFindings(completedText),
            });
          }
        }
      }
    }
  }

  return {
    status: 'ok',
    sessionJsonl,
    runId,
    events,
    stats: {
      inspectedLines,
      invalidJsonLines,
      eventCount: events.length,
      turnCount: turnIndex,
    },
  };
};

const writeEvents = async (output, events) => {
  const outputPath = path.resolve(output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${events.map((event) => JSON.stringify(event)).join('\n')}\n`);
  return outputPath;
};

const main = async () => {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage);
      return;
    }

    const result = await importSessionObservability(options);
    const outputPath = options.output ? await writeEvents(options.output, result.events) : null;

    if (options.format === 'jsonl') {
      process.stdout.write(`${result.events.map((event) => JSON.stringify(event)).join('\n')}\n`);
      return;
    }

    process.stdout.write(
      `${JSON.stringify(
        {
          status: result.status,
          sessionJsonl: result.sessionJsonl,
          runId: result.runId,
          outputPath,
          stats: result.stats,
        },
        null,
        2,
      )}\n`,
    );
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage}`);
    process.exitCode = 1;
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
