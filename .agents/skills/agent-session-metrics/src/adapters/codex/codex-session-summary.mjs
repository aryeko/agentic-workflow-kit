import { basename } from 'node:path';

import { unavailableTokenUsage } from '../../contracts.mjs';
import { readJsonlFile } from '../../jsonl-reader.mjs';
import { extractCodexFacts } from './codex-record-parsers.mjs';

export async function summarizeCodexSession({ recordPath }) {
  const { records, stats, warnings: readerWarnings } = await readJsonlFile(recordPath);
  const warnings = [...readerWarnings];
  const counts = {
    lines: stats.lineCount,
    invalidJsonLines: stats.invalidJsonLines,
    turns: 0,
    messages: 0,
    toolCalls: 0,
    tokenCountEvents: 0,
    unknownRecords: 0,
  };

  let sessionId = null;
  let parentSessionId = null;
  let depth = null;
  let cwd = null;
  let threadSource = null;
  let agentRole = null;
  let agentNickname = null;
  let modelProvider = null;
  let model = null;
  let effort = null;
  let startedAt = null;
  let completedAt = null;
  let tokenUsage = null;

  for (const entry of records) {
    const facts = extractCodexFacts(entry.value);
    if (facts.recordType && !knownRecordTypes.has(facts.recordType)) {
      counts.unknownRecords += 1;
    }

    if (facts.sessionId) {
      if (sessionId && sessionId !== facts.sessionId) {
        warnings.push(`Conflicting session id at line ${entry.lineNumber}; keeping first observed id`);
      } else {
        sessionId = facts.sessionId;
      }
    }

    parentSessionId = facts.parentSessionId ?? parentSessionId;
    depth = facts.depth ?? depth;
    cwd = facts.cwd ?? cwd;
    threadSource = facts.threadSource ?? threadSource;
    agentRole = facts.agentRole ?? agentRole;
    agentNickname = facts.agentNickname ?? agentNickname;
    modelProvider = facts.modelProvider ?? modelProvider;
    model = facts.model ?? model;
    effort = facts.effort ?? effort;

    if (facts.isTurn) {
      counts.turns += 1;
    }
    if (facts.isMessage) {
      counts.messages += 1;
    }
    if (facts.isToolCall) {
      counts.toolCalls += 1;
    }
    if (facts.tokenUsage) {
      counts.tokenCountEvents += 1;
      tokenUsage = facts.tokenUsage;
    }

    if (facts.timestamp) {
      startedAt = minIso(startedAt, facts.timestamp);
      completedAt = maxIso(completedAt, facts.timestamp);
    }
  }

  if (!sessionId) {
    sessionId = fallbackSessionId(recordPath);
    warnings.push('Session id unavailable in records; using filename fallback');
  }
  if (counts.invalidJsonLines > 0 && records.length === 0) {
    warnings.push('Every non-empty line was invalid JSON');
  }
  if (!tokenUsage) {
    tokenUsage = unavailableTokenUsage();
    warnings.push('Token usage unavailable');
  }

  return {
    provider: 'codex',
    sessionId,
    recordPath,
    parentSessionId,
    depth,
    cwd,
    threadSource,
    agentRole,
    agentNickname,
    modelProvider,
    model,
    effort,
    startedAt,
    completedAt,
    durationMs: durationMs(startedAt, completedAt),
    tokenUsage,
    counts,
    warnings,
  };
}

const knownRecordTypes = new Set(['session_meta', 'turn_context', 'event_msg', 'response_item', 'collab_tool_call']);

function fallbackSessionId(recordPath) {
  return basename(recordPath)
    .replace(/\.jsonl$/u, '')
    .replace(/^rollout-/u, '');
}

function minIso(left, right) {
  if (!left) {
    return right;
  }
  return Date.parse(right) < Date.parse(left) ? right : left;
}

function maxIso(left, right) {
  if (!left) {
    return right;
  }
  return Date.parse(right) > Date.parse(left) ? right : left;
}

function durationMs(startedAt, completedAt) {
  if (!startedAt || !completedAt) {
    return null;
  }
  const started = Date.parse(startedAt);
  const completed = Date.parse(completedAt);
  if (!Number.isFinite(started) || !Number.isFinite(completed) || completed < started) {
    return null;
  }
  return completed - started;
}
