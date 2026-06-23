#!/usr/bin/env node

import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const usage = `Usage: node scripts/find-worker-aliases.mjs --session-jsonl <path> [options]

Extract worker aliases from Codex/agent session JSONL without loading the full
transcript into memory. The script scans line-by-line and inspects only session
metadata, spawn_agent calls, matching spawn outputs, and concise agent status
messages.

Options:
  --session-jsonl <path>  Codex/agent session JSONL path
  --format <json|text|workers>
                          Output format (default: json). "workers" prints the
                          comma-separated value accepted by analyze-delivery-run.
  --help                  Show this help
`;

const aliasPattern = /^[a-z0-9][a-z0-9_.:-]{1,127}$/i;
const agentIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sourceKindOrder = ['spawn_agent', 'record_field', 'event_msg'];

const ok = (value) => value !== null && value !== undefined && value !== '';

const uniqueSorted = (values) => [...new Set(values.filter(ok).map((value) => String(value).trim()))].sort();

const parseArgs = (argv) => {
  const options = { format: 'json' };

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
    } else if (arg === '--format') {
      options.format = value;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }

    index += 1;
  }

  if (!['json', 'text', 'workers'].includes(options.format)) {
    throw new Error(`Unsupported --format ${options.format}; expected json, text, or workers`);
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

const getRecordValue = (record, keys) => {
  if (!record || typeof record !== 'object') {
    return null;
  }

  for (const key of keys) {
    if (ok(record[key])) {
      return record[key];
    }
  }

  return null;
};

const isAlias = (value) => typeof value === 'string' && aliasPattern.test(value);

const isAgentId = (value) => typeof value === 'string' && agentIdPattern.test(value);

const extractAliasFromMessage = (message) => {
  if (typeof message !== 'string') {
    return null;
  }

  const aliasMatch = message.match(/(?:^|\n)\s*Alias:\s*([a-z0-9_.:-]+)/i);
  if (isAlias(aliasMatch?.[1])) {
    return aliasMatch[1];
  }

  return null;
};

const extractRunningSubagent = (message) => {
  if (typeof message !== 'string') {
    return null;
  }

  const match = message.match(/`([^`]+)`\s+is running as subagent\s+`([^`]+)`/i);
  if (!isAlias(match?.[1]) || !isAgentId(match?.[2])) {
    return null;
  }

  return { alias: match[1], agentId: match[2] };
};

const sourceKindsForOutput = (sourceKinds) =>
  [...sourceKinds].sort((left, right) => sourceKindOrder.indexOf(left) - sourceKindOrder.indexOf(right));

const confidenceFor = (sourceKinds) =>
  sourceKinds.has('spawn_agent') || sourceKinds.has('record_field') || sourceKinds.has('event_msg')
    ? 'observed'
    : 'reconstructed';

const createCollector = () => {
  const aliases = new Map();
  const aliasesByCallId = new Map();

  const upsert = (alias, details) => {
    if (!isAlias(alias)) {
      return;
    }

    const current = aliases.get(alias) ?? {
      alias,
      agentIds: new Set(),
      callIds: new Set(),
      sourceKinds: new Set(),
      firstSeen: null,
      lastSeen: null,
      occurrences: 0,
    };

    if (isAgentId(details.agentId) || isAlias(details.agentId)) {
      current.agentIds.add(details.agentId);
    }
    if (ok(details.callId)) {
      current.callIds.add(String(details.callId));
      aliasesByCallId.set(String(details.callId), alias);
    }
    if (ok(details.sourceKind)) {
      current.sourceKinds.add(String(details.sourceKind));
    }
    if (ok(details.timestamp)) {
      current.firstSeen = current.firstSeen ?? String(details.timestamp);
      current.lastSeen = String(details.timestamp);
    }

    current.occurrences += 1;
    aliases.set(alias, current);
  };

  const linkSpawnOutput = (callId, output, timestamp) => {
    const alias = aliasesByCallId.get(callId);
    if (!alias) {
      return;
    }

    const parsedOutput = parseJsonMaybe(output);
    const agentId = getRecordValue(parsedOutput, ['agent_id', 'agentId', 'worker_id', 'workerId']);
    upsert(alias, { agentId, callId, sourceKind: 'spawn_agent', timestamp });
  };

  const recordSpawnCall = (payload, timestamp) => {
    const spawnArgs = parseJsonMaybe(payload?.arguments);
    const alias =
      getRecordValue(spawnArgs, ['worker_alias', 'workerAlias', 'alias']) ??
      extractAliasFromMessage(spawnArgs?.message);
    if (!alias) {
      return;
    }

    upsert(alias, {
      callId: payload.call_id,
      sourceKind: 'spawn_agent',
      timestamp,
    });
  };

  const recordFieldAliases = (record, timestamp) => {
    const payload = record?.payload && typeof record.payload === 'object' ? record.payload : null;
    for (const source of [record, payload]) {
      if (!source || typeof source !== 'object') {
        continue;
      }

      const alias = getRecordValue(source, ['worker_alias', 'workerAlias', 'alias']);
      const agentId = getRecordValue(source, ['worker_id', 'workerId', 'agent_id', 'agentId', 'thread_id', 'threadId']);
      if (isAlias(alias)) {
        upsert(alias, { agentId, sourceKind: 'record_field', timestamp });
      }
    }
  };

  const recordEventMessage = (payload, timestamp) => {
    const message = payload?.message;
    const runningSubagent = extractRunningSubagent(message);
    if (runningSubagent) {
      upsert(runningSubagent.alias, {
        agentId: runningSubagent.agentId,
        sourceKind: 'event_msg',
        timestamp,
      });
    }

    const alias = extractAliasFromMessage(message);
    if (alias) {
      upsert(alias, { sourceKind: 'event_msg', timestamp });
    }
  };

  const inspectRecord = (record) => {
    const timestamp = getRecordValue(record, ['timestamp', 'time', 'created_at', 'createdAt']);
    const payload = record?.payload && typeof record.payload === 'object' ? record.payload : null;

    recordFieldAliases(record, timestamp);

    if (payload?.type === 'function_call' && payload.name === 'spawn_agent') {
      recordSpawnCall(payload, timestamp);
    }

    if (payload?.type === 'function_call_output') {
      linkSpawnOutput(payload.call_id, payload.output, timestamp);
    }

    if (record?.type === 'event_msg') {
      recordEventMessage(payload, timestamp);
    }
  };

  const result = () =>
    [...aliases.values()]
      .sort((left, right) => left.alias.localeCompare(right.alias))
      .map((entry) => ({
        alias: entry.alias,
        agentIds: uniqueSorted([...entry.agentIds]),
        callIds: uniqueSorted([...entry.callIds]),
        sourceKinds: sourceKindsForOutput(entry.sourceKinds),
        firstSeen: entry.firstSeen,
        lastSeen: entry.lastSeen,
        occurrences: entry.occurrences,
        confidence: confidenceFor(entry.sourceKinds),
      }));

  return { inspectRecord, result };
};

export const findWorkerAliases = async (sessionJsonlPath) => {
  const sessionJsonl = path.resolve(sessionJsonlPath);
  if (!(await fileExists(sessionJsonl))) {
    throw new Error(`Session JSONL not found: ${sessionJsonl}`);
  }

  const collector = createCollector();
  const stream = createReadStream(sessionJsonl, { encoding: 'utf8' });
  const lines = readline.createInterface({ input: stream, crlfDelay: Number.POSITIVE_INFINITY });
  let totalLines = 0;
  let invalidJsonLines = 0;

  for await (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    totalLines += 1;
    const record = parseJsonMaybe(trimmed);
    if (!record) {
      invalidJsonLines += 1;
      continue;
    }

    collector.inspectRecord(record);
  }

  const aliases = collector.result();
  return {
    status: aliases.length > 0 ? 'ok' : 'needs_input',
    sessionJsonl,
    aliases,
    workersArg: aliases.map((entry) => entry.alias).join(','),
    source: {
      totalLines,
      invalidJsonLines,
      inspected: ['record worker fields', 'spawn_agent calls', 'spawn_agent outputs', 'agent status messages'],
    },
    missing: aliases.length > 0 ? [] : ['workerIds'],
  };
};

const renderText = (result) => {
  if (result.status !== 'ok') {
    return `No worker aliases found in ${result.sessionJsonl}\n`;
  }

  return `${result.aliases
    .map((entry) => {
      const ids = entry.agentIds.length > 0 ? ` ids=${entry.agentIds.join(',')}` : '';
      return `${entry.alias} confidence=${entry.confidence} sources=${entry.sourceKinds.join(',')}${ids}`;
    })
    .join('\n')}\n`;
};

const main = async () => {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage);
      return;
    }

    const result = await findWorkerAliases(options.sessionJsonl);
    if (options.format === 'workers') {
      process.stdout.write(`${result.workersArg}\n`);
    } else if (options.format === 'text') {
      process.stdout.write(renderText(result));
    } else {
      process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    }

    if (result.status !== 'ok') {
      process.exitCode = 2;
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage}`);
    process.exitCode = 1;
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
