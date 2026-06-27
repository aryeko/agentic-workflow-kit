import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import readline from 'node:readline';
import { basename } from 'node:path';

import { normalizeTokenBreakdown, numeric, unavailableTokenUsage } from '../../contracts.mjs';

export const codexSessionDataTypes = {
  sessionMeta: 'session-meta',
  spawnedSessions: 'spawned-sessions',
  metrics: 'metrics',
};

const knownRecordTypes = new Set(['session_meta', 'turn_context', 'event_msg', 'response_item', 'collab_tool_call']);
const allDataTypes = new Set(Object.values(codexSessionDataTypes));
const stringFieldCache = new Map();
const numberFieldCache = new Map();

const eventFilterByType = new Map([
  [
    codexSessionDataTypes.sessionMeta,
    [
      /"type"\s*:\s*"session_meta"/u,
      /"thread_spawn"\s*:/u,
      /"parent(?:Session|Thread)Id"\s*:/u,
      /"parent_(?:session|thread)_id"\s*:/u,
    ],
  ],
  [
    codexSessionDataTypes.spawnedSessions,
    [
      /"receiverThreadId"\s*:/u,
      /"receiver_thread_id"\s*:/u,
      /"receiverThreadIds"\s*:/u,
      /"receiver_thread_ids"\s*:/u,
      /"childThreadId"\s*:/u,
      /"child_thread_id"\s*:/u,
      /"childThreadIds"\s*:/u,
      /"child_thread_ids"\s*:/u,
      /"name"\s*:\s*"spawn_agent"/u,
      /agent_id/u,
    ],
  ],
  [
    codexSessionDataTypes.metrics,
    [
      /"type"\s*:\s*"(turn_context|response_item|collab_tool_call|token_count|message|tool_call|function_call)"/u,
      /"token_count"\s*:/u,
      /"total_token_usage"\s*:/u,
      /"last_token_usage"\s*:/u,
      /"usage"\s*:/u,
    ],
  ],
]);

const commandFilterPattern =
  '"type"\\s*:\\s*"(session_meta|turn_context|response_item|collab_tool_call|token_count|message|tool_call|function_call)"|"thread_spawn"\\s*:|"receiverThreadIds?"\\s*:|"receiver_thread_ids?"\\s*:|"childThreadIds?"\\s*:|"child_thread_ids?"\\s*:|"name"\\s*:\\s*"spawn_agent"|agent_id|"parent(Session|Thread)Id"\\s*:|"parent_(session|thread)_id"\\s*:|"token_count"\\s*:|"total_token_usage"\\s*:|"last_token_usage"\\s*:|"usage"\\s*:';

export async function extractCodexSessionData({ recordPath, dataTypes = allDataTypes }) {
  const requestedTypes = normalizeDataTypes(dataTypes);
  const warnings = [];
  const spawnedSessionIds = new Set();
  const counts = {
    lines: 0,
    invalidJsonLines: 0,
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
  let title = null;
  let threadSource = null;
  let agentRole = null;
  let agentNickname = null;
  let modelProvider = null;
  let model = null;
  let effort = null;
  let startedAt = null;
  let completedAt = null;
  let tokenUsage = null;
  const spawnAgentCallIds = new Set();

  for await (const line of readFilteredSessionLines({ recordPath, dataTypes: requestedTypes })) {
    if (!line.trim()) {
      continue;
    }
    counts.lines += 1;
    if (!looksLikeJsonObject(line)) {
      counts.invalidJsonLines += 1;
      warnings.push(`Invalid JSON-like event at filtered line ${counts.lines}`);
      continue;
    }

    const facts = extractCodexLineFacts(line);
    if (facts.recordType && !knownRecordTypes.has(facts.recordType)) {
      counts.unknownRecords += 1;
    }
    if (facts.sessionId) {
      if (sessionId && sessionId !== facts.sessionId) {
        warnings.push('Conflicting session id in filtered events; keeping first observed id');
      } else {
        sessionId = facts.sessionId;
      }
    }

    parentSessionId = facts.parentSessionId ?? parentSessionId;
    depth = facts.depth ?? depth;
    cwd = facts.cwd ?? cwd;
    title = facts.title ?? title;
    threadSource = facts.threadSource ?? threadSource;
    agentRole = facts.agentRole ?? agentRole;
    agentNickname = facts.agentNickname ?? agentNickname;
    modelProvider = facts.modelProvider ?? modelProvider;
    model = facts.model ?? model;
    effort = facts.effort ?? effort;

    if (facts.isSpawnAgentCall && facts.callId) {
      spawnAgentCallIds.add(facts.callId);
    }
    for (const childThreadId of facts.directChildThreadIds) {
      spawnedSessionIds.add(childThreadId);
    }
    if (facts.callId && spawnAgentCallIds.has(facts.callId)) {
      for (const childThreadId of facts.spawnAgentChildIds) {
        spawnedSessionIds.add(childThreadId);
      }
    }
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
    warnings.push('Session id unavailable in filtered events; using filename fallback');
  }
  if (requestedTypes.has(codexSessionDataTypes.metrics) && !tokenUsage) {
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
    title,
    threadSource,
    agentRole,
    agentNickname,
    modelProvider,
    model,
    effort,
    startedAt,
    completedAt,
    durationMs: durationMs(startedAt, completedAt),
    tokenUsage: tokenUsage ?? unavailableTokenUsage(),
    counts,
    spawnedSessionIds: [...spawnedSessionIds].sort(),
    warnings,
  };
}

async function* readFilteredSessionLines({ recordPath, dataTypes }) {
  const strategies = [readWithRipgrep, readWithGrep, readWithNode];
  for (const strategy of strategies) {
    try {
      yield* strategy({ recordPath, dataTypes });
      return;
    } catch {}
  }
}

async function* readWithRipgrep({ recordPath, dataTypes }) {
  yield* readCommandLines({
    command: 'rg',
    args: ['--no-heading', commandFilterPattern, recordPath],
    allowedExitCodes: new Set([0, 1]),
    dataTypes,
  });
}

async function* readWithGrep({ recordPath, dataTypes }) {
  yield* readCommandLines({
    command: 'grep',
    args: ['-E', commandFilterPattern, recordPath],
    allowedExitCodes: new Set([0, 1]),
    dataTypes,
  });
}

async function* readCommandLines({ command, args, allowedExitCodes, dataTypes }) {
  const child = spawn(command, args, { shell: false });
  const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  let failure = null;
  let exitCode = null;

  child.on('error', (error) => {
    failure = error;
  });
  child.on('close', (code) => {
    exitCode = code;
  });

  for await (const line of rl) {
    if (lineMatchesDataTypes(line, dataTypes)) {
      yield line;
    }
  }

  await new Promise((resolve) => {
    if (exitCode !== null || failure) {
      resolve();
      return;
    }
    child.on('close', resolve);
    child.on('error', resolve);
  });
  if (failure) {
    throw failure;
  }
  if (!allowedExitCodes.has(exitCode)) {
    throw new Error(`${command} exited with code ${exitCode}`);
  }
}

async function* readWithNode({ recordPath, dataTypes }) {
  const rl = readline.createInterface({ input: createReadStream(recordPath), crlfDelay: Infinity });
  for await (const line of rl) {
    if (lineMatchesDataTypes(line, dataTypes)) {
      yield line;
    }
  }
}

function lineMatchesDataTypes(line, dataTypes) {
  for (const dataType of dataTypes) {
    const patterns = eventFilterByType.get(dataType) ?? [];
    if (patterns.some((pattern) => pattern.test(line))) {
      return true;
    }
  }
  return false;
}

function extractCodexLineFacts(line) {
  const typeValues = [...line.matchAll(/"type"\s*:\s*"([^"]+)"/gu)].map((match) => match[1]);
  const recordType = typeValues[0] ?? null;
  const payloadType = typeValues[1] ?? null;
  const isSessionMetadata =
    recordType === 'session_meta' || payloadType === 'session_meta' || line.includes('"thread_spawn"');
  const sessionId = isSessionMetadata
    ? firstUnescapedStringFromLine(line, ['id', 'sessionId', 'session_id', 'threadId', 'thread_id'])
    : firstUnescapedStringFromLine(line, ['sessionId', 'session_id', 'threadId', 'thread_id']);

  return {
    recordType,
    payloadType,
    sessionId,
    parentSessionId: firstUnescapedStringFromLine(line, [
      'parentSessionId',
      'parent_session_id',
      'parentThreadId',
      'parent_thread_id',
    ]),
    depth: firstNumberFromLine(line, ['depth']),
    cwd: firstUnescapedStringFromLine(line, ['cwd', 'currentWorkingDirectory', 'current_working_directory']),
    title: isSessionMetadata ? firstUnescapedStringFromLine(line, ['title']) : null,
    threadSource: firstUnescapedStringFromLine(line, ['threadSource', 'thread_source', 'kind']),
    agentRole: isSessionMetadata
      ? firstUnescapedStringFromLine(line, ['agentRole', 'agent_role', 'role'])
      : firstUnescapedStringFromLine(line, ['agentRole', 'agent_role']),
    agentNickname: firstUnescapedStringFromLine(line, ['agentNickname', 'agent_nickname', 'nickname']),
    modelProvider: firstUnescapedStringFromLine(line, ['modelProvider', 'model_provider', 'provider']),
    model: firstUnescapedStringFromLine(line, ['model', 'modelName', 'model_name']),
    effort: firstUnescapedStringFromLine(line, ['effort', 'reasoningEffort', 'reasoning_effort']),
    timestamp: firstUnescapedStringFromLine(line, ['timestamp', 'createdAt', 'created_at']),
    tokenUsage: extractTokenUsageFromLine(line),
    callId: firstUnescapedStringFromLine(line, ['call_id', 'callId']),
    isSpawnAgentCall: payloadType === 'function_call' && firstUnescapedStringFromLine(line, ['name']) === 'spawn_agent',
    directChildThreadIds: allUnescapedFieldStringsFromLine(line, [
      'receiverThreadId',
      'receiver_thread_id',
      'receiverThreadIds',
      'receiver_thread_ids',
      'childThreadId',
      'child_thread_id',
      'childThreadIds',
      'child_thread_ids',
    ]),
    spawnAgentChildIds: payloadType === 'function_call_output' ? allStringsFromLine(line, ['agent_id']) : [],
    isMessage: isMessageLine({ recordType, payloadType, line }),
    isToolCall: isToolCallLine({ recordType, payloadType, line }),
    isTurn: recordType === 'turn_context' || payloadType === 'turn_context',
  };
}

function extractTokenUsageFromLine(line) {
  if (!line.includes('token_count') && !line.includes('total_token_usage') && !line.includes('"usage"')) {
    return null;
  }
  const total = normalizeTokenBreakdown(extractTokenObject(line, ['total', 'total_token_usage']));
  const last = normalizeTokenBreakdown(extractTokenObject(line, ['last', 'last_token_usage']));
  if (!total && !last) {
    return null;
  }
  return {
    status: 'observed',
    source: 'codex_token_count',
    total,
    last,
    modelContextWindow: firstNumberFromLine(line, ['modelContextWindow', 'model_context_window']),
  };
}

function extractTokenObject(line, keys) {
  const objectText = firstObjectTextFromLine(line, keys);
  if (!objectText) {
    return null;
  }
  return {
    inputTokens: firstNumberFromText(objectText, ['inputTokens', 'input_tokens']),
    cachedInputTokens: firstNumberFromText(objectText, ['cachedInputTokens', 'cached_input_tokens']),
    outputTokens: firstNumberFromText(objectText, ['outputTokens', 'output_tokens']),
    reasoningOutputTokens: firstNumberFromText(objectText, ['reasoningOutputTokens', 'reasoning_output_tokens']),
    totalTokens: firstNumberFromText(objectText, ['totalTokens', 'total_tokens']),
  };
}

function firstObjectTextFromLine(line, keys) {
  for (const key of keys) {
    const pattern = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*\\{`, 'u');
    const match = pattern.exec(line);
    if (!match) {
      continue;
    }
    const start = match.index + match[0].lastIndexOf('{');
    const end = findMatchingBrace(line, start);
    if (end !== -1) {
      return line.slice(start + 1, end);
    }
  }
  return null;
}

function findMatchingBrace(text, start) {
  let depth = 0;
  for (let index = start; index < text.length; index += 1) {
    if (text[index] === '{') {
      depth += 1;
    } else if (text[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }
  return -1;
}

function isMessageLine({ recordType, payloadType, line }) {
  return (
    payloadType === 'message' ||
    recordType === 'response_item' ||
    (recordType === 'response_item' && /"role"\s*:/u.test(line))
  );
}

function isToolCallLine({ recordType, payloadType, line }) {
  return (
    payloadType === 'tool_call' ||
    payloadType === 'function_call' ||
    payloadType === 'collab_tool_call' ||
    recordType === 'collab_tool_call' ||
    (recordType === 'response_item' && /"name"\s*:/u.test(line))
  );
}

function firstUnescapedStringFromLine(line, keys) {
  for (const key of keys) {
    const match = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*"([^"]*)"`, 'u').exec(line);
    if (match?.[1]) {
      return match[1];
    }
  }
  return null;
}

function allStringsFromLine(line, keys) {
  const values = [];
  for (const key of keys) {
    const pattern = cachedStringPattern(key);
    for (const match of line.matchAll(pattern)) {
      values.push(match[1]);
    }
  }
  return values;
}

function allUnescapedFieldStringsFromLine(line, keys) {
  const values = [];
  for (const key of keys) {
    const scalarPattern = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*"([^"]*)"`, 'gu');
    for (const match of line.matchAll(scalarPattern)) {
      values.push(match[1]);
    }
    const arrayPattern = new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*\\[([^\\]]*)\\]`, 'gu');
    for (const arrayMatch of line.matchAll(arrayPattern)) {
      for (const valueMatch of arrayMatch[1].matchAll(/"([^"]+)"/gu)) {
        values.push(valueMatch[1]);
      }
    }
  }
  return values;
}

function firstNumberFromLine(line, keys) {
  return firstNumberFromText(line, keys);
}

function firstNumberFromText(text, keys) {
  for (const key of keys) {
    const match = cachedNumberPattern(key).exec(text);
    const number = match ? Number(match[1]) : null;
    if (numeric(number) !== null) {
      return number;
    }
  }
  return null;
}

function cachedStringPattern(key) {
  if (!stringFieldCache.has(key)) {
    stringFieldCache.set(
      key,
      new RegExp(`(?:\\\\)?"${escapeRegExp(key)}(?:\\\\)?"\\s*:\\s*(?:\\\\)?"([^"\\\\]*)`, 'gu'),
    );
  }
  const pattern = stringFieldCache.get(key);
  pattern.lastIndex = 0;
  return pattern;
}

function cachedNumberPattern(key) {
  if (!numberFieldCache.has(key)) {
    numberFieldCache.set(key, new RegExp(`"${escapeRegExp(key)}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, 'u'));
  }
  return numberFieldCache.get(key);
}

function normalizeDataTypes(dataTypes) {
  const source = dataTypes instanceof Set ? dataTypes : new Set(dataTypes);
  const normalized = new Set();
  for (const dataType of source) {
    if (allDataTypes.has(dataType)) {
      normalized.add(dataType);
    }
  }
  return normalized.size > 0 ? normalized : new Set(allDataTypes);
}

function looksLikeJsonObject(line) {
  const trimmed = line.trim();
  return trimmed.startsWith('{') && trimmed.endsWith('}');
}

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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}
