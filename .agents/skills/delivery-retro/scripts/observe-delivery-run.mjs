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
  --payload <json>     Event payload object, excluding type/runId/source/sequence
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

const nextSequence = async (eventsPath) => {
  try {
    const text = await readFile(eventsPath, 'utf8');
    return (
      text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean).length + 1
    );
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') {
      return 1;
    }
    throw error;
  }
};

export const appendObservabilityEvent = async (options) => {
  const eventsPath = path.resolve(options.events);
  const payload = parsePayload(options.payload);
  const sequence = await nextSequence(eventsPath);
  const event = {
    version: 1,
    sequence,
    runId: options.runId ?? null,
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
