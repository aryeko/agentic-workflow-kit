#!/usr/bin/env node

import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const requiredHandles = ['packagePath', 'sessionJsonl', 'pr', 'workerIds', 'gitRange'];

const usage = `Usage: node scripts/analyze-delivery-run.mjs [options]

Required handles are resolved from explicit arguments or durable artifacts.
If any required handle cannot be resolved, the script prints a needs_input
JSON result and exits 2.

Options:
  --package <path>        Execution package directory
  --tracker <path>        execution/tracker.md path
  --session-jsonl <path>  Codex/agent session JSONL path
  --events <path>         Normalized delivery observability JSONL path
  --pr <url|number>       PR URL or number
  --workers <ids>         Comma-separated worker thread ids or aliases
  --git-range <range>     Git range, for example abc1234..def5678
  --repo <path>           Repo root for auto-resolution (default: cwd)
  --format <json|md>      Output format (default: json)
  --help                  Show this help
`;

const ok = (value) => value !== null && value !== undefined && value !== '';

const unique = (values) => [
  ...new Set(
    values
      .filter(ok)
      .map((value) => String(value).trim())
      .filter(Boolean),
  ),
];

const normalizeKey = (value) =>
  value
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, ' ')
    .trim();

const fileExists = async (candidate) => {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
};

const readIfExists = async (candidate) => ((await fileExists(candidate)) ? await readFile(candidate, 'utf8') : '');

const resolveExistingPath = async (candidate, bases) => {
  if (!candidate) {
    return null;
  }

  const trimmed = candidate.trim();
  const candidates = path.isAbsolute(trimmed) ? [trimmed] : bases.map((base) => path.resolve(base, trimmed));

  for (const possible of candidates) {
    if (await fileExists(possible)) {
      return possible;
    }
  }

  return null;
};

const parseArgs = (argv) => {
  const options = { repo: process.cwd(), format: 'json' };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--help') {
      return { ...options, help: true };
    }

    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for ${arg}`);
    }

    if (arg === '--package') {
      options.packagePath = value;
    } else if (arg === '--tracker') {
      options.trackerPath = value;
    } else if (arg === '--session-jsonl') {
      options.sessionJsonl = value;
    } else if (arg === '--events') {
      options.eventsPath = value;
    } else if (arg === '--pr') {
      options.pr = value;
    } else if (arg === '--workers') {
      options.workerIds = value;
    } else if (arg === '--git-range') {
      options.gitRange = value;
    } else if (arg === '--repo') {
      options.repo = value;
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

  return options;
};

const findExecutionPackages = async (repoRoot) => {
  const epicsRoot = path.join(repoRoot, 'docs/implementation/epics');
  if (!(await fileExists(epicsRoot))) {
    return [];
  }

  const entries = await readdir(epicsRoot, { withFileTypes: true });
  const packages = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const packagePath = path.join(epicsRoot, entry.name, 'execution');
    if (await fileExists(path.join(packagePath, 'tracker.md'))) {
      packages.push(packagePath);
    }
  }

  return packages;
};

const resolvePackagePath = async (options, attempted) => {
  const repoRoot = path.resolve(options.repo ?? process.cwd());
  if (options.packagePath) {
    attempted.packagePath.push('--package');
    const packagePath = path.resolve(repoRoot, options.packagePath);
    return (await fileExists(packagePath)) ? packagePath : null;
  }

  if (options.trackerPath) {
    attempted.packagePath.push('--tracker parent');
    const trackerPath = path.resolve(repoRoot, options.trackerPath);
    return (await fileExists(trackerPath)) ? path.dirname(trackerPath) : null;
  }

  attempted.packagePath.push('cwd execution/tracker.md');
  if (await fileExists(path.join(repoRoot, 'execution/tracker.md'))) {
    return path.join(repoRoot, 'execution');
  }

  attempted.packagePath.push('docs/implementation/epics/*/execution');
  const packages = await findExecutionPackages(repoRoot);
  return packages.length === 1 ? packages[0] : null;
};

const parseMarkdownTable = (text) => {
  const rows = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('|') && line.endsWith('|'))
    .map((line) =>
      line
        .slice(1, -1)
        .split('|')
        .map((cell) => cell.trim()),
    );

  if (rows.length < 2) {
    return [];
  }

  const header = rows[0].map(normalizeKey);
  const dataRows = rows.slice(1).filter((row) => !row.every((cell) => /^:?-{3,}:?$/.test(cell)));

  return dataRows.map((row) => Object.fromEntries(header.map((key, index) => [key, row[index] ?? ''])));
};

const extractFirst = (texts, patterns) => {
  for (const text of texts) {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
      if (match?.[0]) {
        return match[0].trim();
      }
    }
  }

  return null;
};

const extractWorkerIdsFromText = (text) => {
  const matches = [...text.matchAll(/workers?\s*:\s*([^|\n]+)/gi)];
  return unique(
    matches.flatMap((match) =>
      match[1]
        .split(/[,;]/)
        .map((value) => value.trim())
        .filter((value) => /^[a-z0-9_.:-]+$/i.test(value)),
    ),
  );
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
        return { raw: line };
      }
    });

const textFromRecord = (record) => {
  if (typeof record === 'string') {
    return record;
  }
  if (record === null || typeof record !== 'object') {
    return '';
  }
  return JSON.stringify(record);
};

const getRecordValue = (record, keys) => {
  if (record === null || typeof record !== 'object') {
    return null;
  }

  for (const key of keys) {
    if (ok(record[key])) {
      return record[key];
    }
  }

  return null;
};

const extractWorkerIdsFromRecords = (records) =>
  unique(
    records.flatMap((record) => [
      getRecordValue(record, [
        'worker_alias',
        'workerAlias',
        'alias',
        'thread_id',
        'threadId',
        'worker_id',
        'workerId',
      ]),
    ]),
  );

const workerIdFromEvent = (record) => {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const worker = record.worker && typeof record.worker === 'object' ? record.worker : {};
  return (
    worker.alias ??
    worker.agentId ??
    worker.agent_id ??
    worker.nickname ??
    record.workerAlias ??
    record.worker_alias ??
    record.workerId ??
    record.worker_id ??
    record.agentId ??
    record.agent_id ??
    null
  );
};

const extractWorkerIdsFromEvents = (records) => unique(records.map(workerIdFromEvent));

const resolveObservabilityEvents = async (options, packagePath, repoRoot) => {
  const bases = unique([packagePath, repoRoot, process.cwd()]);
  const attempted = [];

  attempted.push('--events');
  let eventsPath = await resolveExistingPath(options.eventsPath, bases);
  if (eventsPath) {
    return { eventsPath, attempted };
  }

  if (packagePath) {
    attempted.push('execution package observability/events.jsonl');
    eventsPath = await resolveExistingPath(path.join(packagePath, 'observability/events.jsonl'), bases);
  }

  if (eventsPath) {
    return { eventsPath, attempted };
  }

  attempted.push('execution package events.jsonl');
  eventsPath = packagePath ? await resolveExistingPath(path.join(packagePath, 'events.jsonl'), bases) : null;

  return { eventsPath, attempted };
};

const resolveHandles = async (options) => {
  const repoRoot = path.resolve(options.repo ?? process.cwd());
  const attempted = Object.fromEntries([...requiredHandles, 'observabilityEvents'].map((handle) => [handle, []]));
  const packagePath = await resolvePackagePath(options, attempted);
  const planPath = packagePath ? path.join(packagePath, 'plan.md') : null;
  const trackerPath = packagePath ? path.join(packagePath, 'tracker.md') : null;
  const planText = planPath ? await readIfExists(planPath) : '';
  const trackerText = trackerPath ? await readIfExists(trackerPath) : '';
  const artifactTexts = [planText, trackerText].filter(Boolean);
  const bases = unique([packagePath, repoRoot, process.cwd()]);

  const observabilityResolution = await resolveObservabilityEvents(options, packagePath, repoRoot);
  attempted.observabilityEvents.push(...observabilityResolution.attempted);
  const observabilityEventsText = observabilityResolution.eventsPath
    ? await readIfExists(observabilityResolution.eventsPath)
    : '';
  const observabilityEvents = observabilityEventsText ? parseJsonl(observabilityEventsText) : [];

  attempted.sessionJsonl.push('--session-jsonl');
  let sessionJsonl = await resolveExistingPath(options.sessionJsonl, bases);
  if (!sessionJsonl) {
    attempted.sessionJsonl.push('execution package text');
    const candidate = extractFirst(artifactTexts, [
      /Session JSONL:\s*([^\n|]+)/i,
      /session_jsonl:\s*([^\n|]+)/i,
      /([\w./-]*rollout-[\w./-]+\.jsonl)/i,
      /(\/[^\s|)]+sessions\/[^\s|)]+\.jsonl)/i,
    ]);
    sessionJsonl = await resolveExistingPath(candidate, bases);
  }

  const sessionText = sessionJsonl ? await readIfExists(sessionJsonl) : '';
  const sessionRecords = sessionText ? parseJsonl(sessionText) : [];
  const allTexts = [...artifactTexts, sessionText].filter(Boolean);

  attempted.pr.push('--pr');
  let pr = options.pr ?? null;
  if (!pr) {
    attempted.pr.push('execution package/session text');
    pr = extractFirst(allTexts, [
      /https:\/\/github\.com\/[^\s|)]+\/pull\/\d+/i,
      /\bPR:\s*(https:\/\/github\.com\/[^\s|)]+\/pull\/\d+)/i,
      /\bPR\s*#?(\d+)\b/i,
      /\bpr:\s*#?(\d+)\b/i,
    ]);
  }

  attempted.gitRange.push('--git-range');
  let gitRange = options.gitRange ?? null;
  if (!gitRange) {
    attempted.gitRange.push('execution package/session text');
    gitRange = extractFirst(allTexts, [/\b[0-9a-f]{7,40}\.\.[0-9a-f]{7,40}\b/i]);
  }

  attempted.workerIds.push('--workers');
  const eventWorkerIds = extractWorkerIdsFromEvents(observabilityEvents);
  let workerIds =
    observabilityEvents.length > 0 && eventWorkerIds.length > 0
      ? eventWorkerIds
      : options.workerIds
        ? unique(options.workerIds.split(','))
        : [];
  if (workerIds.length === 0) {
    attempted.workerIds.push('observability events worker fields');
  }
  if (workerIds.length === 0) {
    attempted.workerIds.push('session JSONL worker fields');
    workerIds = extractWorkerIdsFromRecords(sessionRecords);
  }
  if (workerIds.length === 0) {
    attempted.workerIds.push('execution package text workers:');
    workerIds = extractWorkerIdsFromText(allTexts.join('\n'));
  }

  return {
    attempted,
    handles: {
      packagePath,
      sessionJsonl,
      observabilityEvents: observabilityResolution.eventsPath,
      pr,
      workerIds,
      gitRange,
    },
    packageText: { planText, trackerText },
    sessionRecords,
    observabilityEvents,
  };
};

const missingHandles = (handles) =>
  requiredHandles.filter((handle) => {
    const value = handles[handle];
    return Array.isArray(value) ? value.length === 0 : !ok(value);
  });

const eventTimestamp = (record) => {
  const value = getRecordValue(record, ['timestamp', 'time', 'created_at', 'createdAt']);
  const time = value ? Date.parse(String(value)) : Number.NaN;
  return Number.isNaN(time) ? null : time;
};

const storyIdForRow = (row) => row['story id'] || row.story || row.id || 'unknown';

const storyIdForRecord = (record) => {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const worker = record.worker && typeof record.worker === 'object' ? record.worker : {};
  const scope = record.scope && typeof record.scope === 'object' ? record.scope : {};
  if (scope.type === 'story' && ok(scope.id)) {
    return String(scope.id);
  }

  return (
    getRecordValue(record, ['story_id', 'storyId', 'story']) ??
    getRecordValue(worker, ['story_id', 'storyId', 'story']) ??
    null
  );
};

const recordsForStory = (records, storyId) =>
  records.filter((record) => {
    const recordStoryId = storyIdForRecord(record);
    return recordStoryId ? String(recordStoryId) === storyId : textFromRecord(record).includes(storyId);
  });

const classifyFinding = (finding) => {
  if (finding && typeof finding === 'object' && ok(finding.class)) {
    return String(finding.class);
  }

  const text = typeof finding === 'string' ? finding : JSON.stringify(finding ?? '');
  const lowered = text.toLowerCase();
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
  if (lowered.includes('ac-') || lowered.includes('acceptance')) {
    return 'ac-miss';
  }
  return 'other';
};

const findingsFromRecord = (record) => {
  if (!record || typeof record !== 'object') {
    return [];
  }

  const findings = record.findings ?? record.finding ?? [];
  if (Array.isArray(findings)) {
    return findings.map((finding) => ({
      class: classifyFinding(finding),
      summary: typeof finding === 'string' ? finding : (finding.summary ?? finding.text ?? JSON.stringify(finding)),
    }));
  }

  if (ok(findings)) {
    return [{ class: classifyFinding(findings), summary: String(findings) }];
  }

  return [];
};

const tokenUsageFromRecord = (record) => {
  if (!record || typeof record !== 'object') {
    return null;
  }

  const usage = record.token_usage ?? record.tokenUsage ?? record.usage;
  if (!usage || typeof usage !== 'object') {
    return null;
  }

  const input = usage.input ?? usage.input_tokens ?? usage.prompt_tokens ?? null;
  const cachedInput = usage.cachedInput ?? usage.cached_input_tokens ?? usage.cached_input ?? null;
  const output = usage.output ?? usage.output_tokens ?? usage.completion_tokens ?? null;
  const reasoning = usage.reasoning ?? usage.reasoning_tokens ?? null;
  const total = usage.total ?? usage.total_tokens ?? null;

  if (![input, cachedInput, output, reasoning, total].some((value) => typeof value === 'number')) {
    return null;
  }

  return {
    input: typeof input === 'number' ? input : 0,
    cachedInput: typeof cachedInput === 'number' ? cachedInput : 0,
    output: typeof output === 'number' ? output : 0,
    reasoning: typeof reasoning === 'number' ? reasoning : 0,
    total:
      typeof total === 'number'
        ? total
        : [input, output, reasoning]
            .filter((value) => typeof value === 'number')
            .reduce((sum, value) => sum + value, 0),
  };
};

const unavailableTokenUsage = (source) => ({
  status: 'unavailable',
  source,
  confidence: 'observed',
  checked: [source],
});

const sumTokenUsage = (records, source) => {
  const usageValues = records.map(tokenUsageFromRecord).filter(Boolean);
  if (usageValues.length === 0) {
    return unavailableTokenUsage(source);
  }

  return {
    status: 'observed',
    source,
    confidence: 'observed',
    input: usageValues.reduce((sum, usage) => sum + usage.input, 0),
    cachedInput: usageValues.reduce((sum, usage) => sum + usage.cachedInput, 0),
    output: usageValues.reduce((sum, usage) => sum + usage.output, 0),
    reasoning: usageValues.reduce((sum, usage) => sum + usage.reasoning, 0),
    total: usageValues.reduce((sum, usage) => sum + usage.total, 0),
  };
};

const latestTokenUsage = (records, source) => {
  const sourceRecords =
    source === 'observability-events'
      ? records.filter((record) => record && typeof record === 'object' && record.type === 'token_usage_observed')
      : records;
  const usageValues = sourceRecords.map(tokenUsageFromRecord).filter(Boolean);
  if (usageValues.length === 0) {
    return unavailableTokenUsage(source);
  }

  return {
    status: 'observed',
    source,
    confidence: 'observed',
    ...usageValues.at(-1),
  };
};

const summarizeTokenUsage = (records, source) =>
  source === 'observability-events' ? latestTokenUsage(records, source) : sumTokenUsage(records, source);

const isReviewEvent = (record, source) => {
  if (!record || typeof record !== 'object') {
    return false;
  }

  if (source === 'observability-events') {
    return ['review_completed', 'pr_reviewed', 'pr_fixed'].includes(String(record.type ?? '').toLowerCase());
  }

  const role = String(getRecordValue(record, ['role']) ?? '').toLowerCase();
  const event = String(getRecordValue(record, ['event', 'type']) ?? '').toLowerCase();
  return role === 'reviewer' && ['blocking', 'approved', 'reviewed', 'review', 'rereview'].includes(event);
};

const summarizeTurns = (records, source) => {
  const turns =
    source === 'observability-events'
      ? records.filter((record) => record && typeof record === 'object' && record.type === 'turn_observed')
      : records.filter((record) => {
          const role = String(getRecordValue(record, ['role']) ?? '').toLowerCase();
          return ['user', 'assistant'].includes(role);
        });

  if (turns.length === 0) {
    return {
      total: 0,
      byRole: {},
      source,
      confidence: 'unavailable',
      checked: [source],
    };
  }

  const byRole = {};
  for (const record of turns) {
    const role = String(getRecordValue(record, ['role']) ?? 'unknown').toLowerCase();
    byRole[role] = (byRole[role] ?? 0) + 1;
  }

  return {
    total: turns.length,
    byRole,
    source,
    confidence: 'observed',
  };
};

const buildStoryReport = (row, records, source) => {
  const storyId = storyIdForRow(row);
  const storyRecords = recordsForStory(records, storyId);
  const findings = storyRecords.flatMap(findingsFromRecord);
  const reviewEvents = storyRecords.filter((record) => isReviewEvent(record, source));
  const timestamps = storyRecords.map(eventTimestamp).filter((value) => value !== null);
  const durationMs = timestamps.length >= 2 ? Math.max(...timestamps) - Math.min(...timestamps) : null;

  return {
    storyId,
    status: row.status ?? '',
    reviewerVerdict: row['reviewer verdict'] ?? row.verdict ?? '',
    gateEvidence: row['gate evidence'] ?? '',
    commitHash: row['commit hash'] ?? row.commit ?? '',
    blockers: row.blockers ?? '',
    reviewRounds: {
      value: reviewEvents.length,
      source,
      confidence: reviewEvents.length > 0 ? 'observed' : 'unavailable',
    },
    findings,
    duration: {
      durationMs,
      source,
      confidence: durationMs === null ? 'unavailable' : 'reconstructed',
    },
    tokenUsage: sumTokenUsage(storyRecords, source),
  };
};

const summarizeFindings = (stories) => {
  const classes = {};
  for (const story of stories) {
    for (const finding of story.findings) {
      classes[finding.class] = (classes[finding.class] ?? 0) + 1;
    }
  }
  return classes;
};

const buildRecommendations = (findingClasses) =>
  Object.entries(findingClasses)
    .filter(([, count]) => count > 1)
    .map(([findingClass, count]) => ({
      type: 'candidate-lessons-ledger-entry',
      findingClass,
      count,
      rationale: 'Recurring finding class observed more than once in this run.',
    }));

const buildReport = ({ handles, packageText, sessionRecords, observabilityEvents }) => {
  const trackerRows = parseMarkdownTable(packageText.trackerText);
  const metricSource = observabilityEvents.length > 0 ? 'observability-events' : 'session-jsonl';
  const metricRecords = observabilityEvents.length > 0 ? observabilityEvents : sessionRecords;
  const stories = trackerRows.map((row) => buildStoryReport(row, metricRecords, metricSource));
  const findingClasses = summarizeFindings(stories);
  const missingObservabilityFields = unique(
    stories.flatMap((story) => [
      story.reviewRounds.confidence === 'unavailable' ? `${story.storyId}:review-rounds` : null,
      story.duration.confidence === 'unavailable' ? `${story.storyId}:duration` : null,
      story.tokenUsage.status === 'unavailable' ? `${story.storyId}:token-usage` : null,
    ]),
  );
  const turns = summarizeTurns(metricRecords, metricSource);
  const eventWorkerIds = extractWorkerIdsFromEvents(observabilityEvents);
  const workerIds = observabilityEvents.length > 0 && eventWorkerIds.length > 0 ? eventWorkerIds : handles.workerIds;
  const tokens = summarizeTokenUsage(metricRecords, metricSource);

  return {
    stories,
    summary: {
      storyCount: stories.length,
      findingClasses,
      highestChurnStories: [...stories]
        .sort((left, right) => right.reviewRounds.value - left.reviewRounds.value)
        .map((story) => ({ storyId: story.storyId, reviewRounds: story.reviewRounds.value })),
      slowestStories: [...stories]
        .filter((story) => story.duration.durationMs !== null)
        .sort((left, right) => right.duration.durationMs - left.duration.durationMs)
        .map((story) => ({ storyId: story.storyId, durationMs: story.duration.durationMs })),
      workerCount: workerIds.length,
      turns,
      tokens,
      missingObservabilityFields: unique([
        ...missingObservabilityFields,
        turns.confidence === 'unavailable' ? 'run:turn-count' : null,
        tokens.status === 'unavailable' ? 'run:token-usage' : null,
      ]),
    },
    recommendations: buildRecommendations(findingClasses),
  };
};

export const analyzeDeliveryRun = async (options = {}) => {
  const resolved = await resolveHandles(options);
  const missing = missingHandles(resolved.handles);

  if (missing.length > 0) {
    return {
      status: 'needs_input',
      missing,
      attempted: resolved.attempted,
      message: 'Required delivery-run handles could not be resolved. Provide only the missing handles.',
    };
  }

  return {
    status: 'ok',
    handles: resolved.handles,
    report: buildReport(resolved),
  };
};

const renderMarkdown = (result) => {
  if (result.status === 'needs_input') {
    return [
      '# Delivery Retro Needs Input',
      '',
      `Missing handles: ${result.missing.join(', ')}`,
      '',
      '## Attempted Sources',
      ...Object.entries(result.attempted).map(([key, values]) => `- ${key}: ${values.join(', ') || 'none'}`),
      '',
    ].join('\n');
  }

  return [
    '# Delivery Retro',
    '',
    `Stories: ${result.report.summary.storyCount}`,
    `Workers: ${result.report.summary.workerCount}`,
    '',
    '## Stories',
    ...result.report.stories.map(
      (story) =>
        `- ${story.storyId}: ${story.status || 'unknown'}; review rounds ${story.reviewRounds.value}; token usage ${
          story.tokenUsage.status
        }`,
    ),
    '',
    '## Finding Classes',
    ...Object.entries(result.report.summary.findingClasses).map(([key, value]) => `- ${key}: ${value}`),
    '',
  ].join('\n');
};

const main = async () => {
  try {
    const options = parseArgs(process.argv.slice(2));
    if (options.help) {
      process.stdout.write(usage);
      return;
    }

    const result = await analyzeDeliveryRun(options);
    process.stdout.write(options.format === 'md' ? renderMarkdown(result) : `${JSON.stringify(result, null, 2)}\n`);
    if (result.status === 'needs_input') {
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
