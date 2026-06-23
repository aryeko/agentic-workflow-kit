#!/usr/bin/env node

import { appendFile, mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const usage = `Usage: node scripts/observe-delivery-run.mjs --events <path> --type <type> --payload <json> [options]

Append one normalized delivery observability event. Use this during future
delivery runs so post-run retros can consume structured events instead of raw
session transcripts.

Options:
  --events <path>      Normalized observability events JSONL path
  --type <type>        Event type, such as turn_observed or worker_spawned
  --payload <json>     Event payload object, excluding type/runId/source/sequence.
                       token_usage_observed usage must be a cumulative snapshot.
  --run-id <id>        Stable delivery run id
  --timestamp <iso>    Event timestamp (default: current time)
  --help               Show this help
`;

const allowedTypes = new Set([
  'run_started',
  'turn_observed',
  'worker_spawned',
  'worker_completed',
  'review_completed',
  'story_committed',
  'pr_opened',
  'pr_reviewed',
  'pr_fixed',
  'pr_merged',
  'token_usage_observed',
]);

const reservedPayloadKeys = new Set(['version', 'sequence', 'runId', 'timestamp', 'type', 'source']);

const parseArgs = (argv) => {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') {
      return { ...options, help: true };
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }

    if (arg === '--events') {
      options.events = value;
    } else if (arg === '--type') {
      options.type = value;
    } else if (arg === '--payload') {
      options.payload = value;
    } else if (arg === '--run-id') {
      options.runId = value;
    } else if (arg === '--timestamp') {
      options.timestamp = value;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }

    index += 1;
  }

  if (!options.help) {
    for (const required of ['events', 'type', 'payload']) {
      if (!options[required]) {
        throw new Error(`Missing required --${required.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`);
      }
    }
  }

  if (options.type && !allowedTypes.has(options.type)) {
    throw new Error(`Unsupported event type ${options.type}`);
  }

  return options;
};

const parsePayload = (value) => {
  try {
    const payload = JSON.parse(value);
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      throw new Error('payload must be a JSON object');
    }

    const reservedKeys = Object.keys(payload).filter((key) => reservedPayloadKeys.has(key));
    if (reservedKeys.length > 0) {
      throw new Error(`payload contains reserved event field(s): ${reservedKeys.join(', ')}`);
    }

    return payload;
  } catch (error) {
    throw new Error(`Invalid --payload JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
};

const parseJsonl = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);

const readEvents = async (eventsPath) => {
  try {
    return parseJsonl(await readFile(eventsPath, 'utf8'));
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const tokenTotal = (usage) => {
  const total = usage?.total ?? usage?.total_tokens;
  return typeof total === 'number' ? total : null;
};

const validateTokenUsagePayload = (payload, existingEvents, runId) => {
  const usage = payload.usage;
  if (!usage || typeof usage !== 'object' || Array.isArray(usage)) {
    throw new Error('token_usage_observed payload must include a usage object');
  }

  const total = tokenTotal(usage);
  if (total === null || total < 0) {
    throw new Error('token_usage_observed usage.total must be a non-negative cumulative total');
  }

  for (const [key, value] of Object.entries(usage)) {
    if (typeof value !== 'number' || value < 0) {
      throw new Error(`token_usage_observed usage.${key} must be a non-negative number`);
    }
  }

  const previousTotals = existingEvents
    .filter((event) => event?.type === 'token_usage_observed' && (event.runId ?? null) === runId)
    .map((event) => tokenTotal(event.usage))
    .filter((value) => value !== null);
  const previousTotal = previousTotals.at(-1);

  if (previousTotal !== undefined && total < previousTotal) {
    throw new Error(
      `token_usage_observed usage.total must be cumulative; received ${total} after previous total ${previousTotal}`,
    );
  }
};

export const appendObservabilityEvent = async (options) => {
  const eventsPath = path.resolve(options.events);
  const payload = parsePayload(options.payload);
  const runId = options.runId ?? null;
  const existingEvents = await readEvents(eventsPath);
  if (options.type === 'token_usage_observed') {
    validateTokenUsagePayload(payload, existingEvents, runId);
  }

  const sequence = existingEvents.length + 1;
  const event = {
    version: 1,
    sequence,
    runId,
    timestamp: options.timestamp ?? new Date().toISOString(),
    type: options.type,
    source: {
      kind: 'delivery-observability-recorder',
      confidence: 'observed',
    },
    ...payload,
  };

  await mkdir(path.dirname(eventsPath), { recursive: true });
  await appendFile(eventsPath, `${JSON.stringify(event)}\n`);
  return { status: 'ok', eventsPath, event };
};

const main = async () => {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage);
      return;
    }

    const result = await appendObservabilityEvent(options);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage}`);
    process.exitCode = 1;
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
