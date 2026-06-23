#!/usr/bin/env node

import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const usage = `Usage: node scripts/summarize-delivery-observability.mjs --events <path> [options]

Summarize normalized delivery observability events. This script reads only
observability JSONL, not raw Codex session transcripts.

Options:
  --events <path>       Normalized observability events JSONL path
  --format <json|md>    Output format (default: json)
  --help                Show this help
`;

const ok = (value) => value !== null && value !== undefined && value !== '';

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

    if (arg === '--events') {
      options.events = value;
    } else if (arg === '--format') {
      options.format = value;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }

    index += 1;
  }

  if (!['json', 'md'].includes(options.format)) {
    throw new Error(`Unsupported --format ${options.format}; expected json or md`);
  }

  if (!options.help && !options.events) {
    throw new Error('Missing required --events path');
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
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const increment = (record, key, amount = 1) => {
  record[key] = (record[key] ?? 0) + amount;
};

const workerKey = (worker) => worker?.alias ?? worker?.agentId ?? worker?.nickname ?? null;

export const summarizeDeliveryObservability = async (options) => {
  const eventsPath = path.resolve(options.events);
  if (!(await fileExists(eventsPath))) {
    throw new Error(`Observability events JSONL not found: ${eventsPath}`);
  }

  const workers = new Map();
  const turnsByRole = {};
  const findingsByClass = {};
  const findingsBySeverity = {};
  const storyMetrics = new Map();
  const reviewVerdicts = { total: 0, changesRequested: 0, approved: 0, other: 0 };
  let totalTurns = 0;
  let inspectedEvents = 0;
  let invalidJsonLines = 0;
  let latestTokenUsage = null;

  const lines = readline.createInterface({
    input: createReadStream(eventsPath, { encoding: 'utf8' }),
    crlfDelay: Number.POSITIVE_INFINITY,
  });

  for await (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }

    const event = parseJsonMaybe(trimmed);
    if (!event) {
      invalidJsonLines += 1;
      continue;
    }

    inspectedEvents += 1;

    if (event.type === 'turn_observed') {
      totalTurns += 1;
      increment(turnsByRole, event.role ?? 'unknown');
    }

    if (event.type === 'token_usage_observed' && event.usage) {
      latestTokenUsage = event.usage;
    }

    if (event.type === 'worker_spawned') {
      const key = workerKey(event.worker);
      if (key) {
        workers.set(key, {
          alias: event.worker.alias ?? null,
          agentId: event.worker.agentId ?? null,
          storyId: event.worker.storyId ?? null,
          role: event.worker.role ?? null,
        });
      }
    }

    if (event.type === 'review_completed') {
      reviewVerdicts.total += 1;
      if (event.verdict === 'changes_requested') {
        reviewVerdicts.changesRequested += 1;
      } else if (event.verdict === 'approved') {
        reviewVerdicts.approved += 1;
      } else {
        reviewVerdicts.other += 1;
      }

      for (const finding of event.findings ?? []) {
        increment(findingsByClass, finding.class ?? 'other');
        increment(findingsBySeverity, finding.severity ?? 'unknown');
      }
    }

    const storyId = event.storyId ?? event.worker?.storyId;
    if (ok(storyId)) {
      const current = storyMetrics.get(storyId) ?? {
        storyId,
        workers: new Set(),
        reviewRounds: 0,
        findings: 0,
      };
      const key = workerKey(event.worker);
      if (key) {
        current.workers.add(key);
      }
      if (event.type === 'review_completed') {
        current.reviewRounds += 1;
        current.findings += (event.findings ?? []).length;
      }
      storyMetrics.set(storyId, current);
    }
  }

  return {
    status: 'ok',
    source: {
      eventsPath,
      rawSessionParsed: false,
      inspectedEvents,
      invalidJsonLines,
    },
    turns: {
      total: totalTurns,
      byRole: turnsByRole,
    },
    tokens: latestTokenUsage
      ? {
          status: 'observed',
          ...latestTokenUsage,
        }
      : {
          status: 'unavailable',
          checked: ['observability-events'],
        },
    workers: {
      total: workers.size,
      items: [...workers.values()],
    },
    reviews: reviewVerdicts,
    findings: {
      byClass: findingsByClass,
      bySeverity: findingsBySeverity,
    },
    stories: [...storyMetrics.values()].map((story) => ({
      storyId: story.storyId,
      workerCount: story.workers.size,
      reviewRounds: story.reviewRounds,
      findings: story.findings,
    })),
  };
};

const renderMarkdown = (summary) =>
  [
    '# Delivery Observability Summary',
    '',
    `Turns: ${summary.turns.total}`,
    `Workers: ${summary.workers.total}`,
    `Reviews: ${summary.reviews.total}`,
    `Token usage: ${summary.tokens.status === 'observed' ? summary.tokens.total : 'unavailable'}`,
    '',
    '## Finding Classes',
    ...Object.entries(summary.findings.byClass).map(([findingClass, count]) => `- ${findingClass}: ${count}`),
    '',
  ].join('\n');

const main = async () => {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage);
      return;
    }

    const summary = await summarizeDeliveryObservability(options);
    process.stdout.write(options.format === 'md' ? renderMarkdown(summary) : `${JSON.stringify(summary, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n\n${usage}`);
    process.exitCode = 1;
  }
};

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await main();
}
