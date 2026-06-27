import { normalizeTokenBreakdown, numeric } from '../../contracts.mjs';

export function extractCodexFacts(record) {
  const payload = objectAt(record.payload) ?? {};
  const spawn =
    objectAt(payload.source?.subagent?.thread_spawn) ??
    objectAt(payload.source?.thread_spawn) ??
    objectAt(payload.thread_spawn) ??
    {};
  const isSessionMetadata =
    record.type === 'session_meta' || payload.type === 'session_meta' || Object.keys(spawn).length > 0;

  return {
    recordType: stringAt(record.type) ?? stringAt(payload.type),
    payloadType: stringAt(payload.type),
    sessionId: isSessionMetadata
      ? firstString(
          payload.id,
          payload.sessionId,
          payload.session_id,
          payload.threadId,
          payload.thread_id,
          record.sessionId,
          record.session_id,
        )
      : firstString(
          payload.sessionId,
          payload.session_id,
          payload.threadId,
          payload.thread_id,
          record.sessionId,
          record.session_id,
        ),
    parentSessionId: firstString(
      payload.parentSessionId,
      payload.parent_session_id,
      payload.parentThreadId,
      payload.parent_thread_id,
      spawn.parentThreadId,
      spawn.parent_thread_id,
      spawn.parentSessionId,
      spawn.parent_session_id,
    ),
    depth: firstNumber(payload.depth, spawn.depth),
    cwd: firstString(payload.cwd, payload.currentWorkingDirectory, payload.current_working_directory),
    title: isSessionMetadata ? firstString(payload.title) : null,
    threadSource: firstString(payload.threadSource, payload.thread_source, payload.source?.kind),
    agentRole: isSessionMetadata
      ? firstString(payload.agentRole, payload.agent_role, payload.role, spawn.agentRole, spawn.agent_role, spawn.role)
      : firstString(spawn.agentRole, spawn.agent_role, spawn.role),
    agentNickname: firstString(
      payload.agentNickname,
      payload.agent_nickname,
      payload.nickname,
      spawn.agentNickname,
      spawn.agent_nickname,
      spawn.nickname,
    ),
    modelProvider: firstString(payload.modelProvider, payload.model_provider, payload.provider),
    model: firstString(payload.model, payload.modelName, payload.model_name),
    effort: firstString(payload.effort, payload.reasoningEffort, payload.reasoning_effort),
    timestamp: firstString(record.timestamp, payload.timestamp, payload.createdAt, payload.created_at),
    tokenUsage: extractTokenUsage(payload),
    childThreadId: firstString(
      payload.receiverThreadId,
      payload.receiver_thread_id,
      payload.childThreadId,
      payload.child_thread_id,
    ),
    isMessage: isMessageRecord(record, payload),
    isToolCall: isToolCallRecord(record, payload),
    isTurn: isTurnRecord(record, payload),
  };
}

export function extractTokenUsage(payload) {
  const isTokenRecord =
    payload.type === 'token_count' ||
    objectAt(payload.token_count) ||
    objectAt(payload.info?.total_token_usage) ||
    objectAt(payload.usage?.total) ||
    objectAt(payload.total);
  if (!isTokenRecord) {
    return null;
  }

  const container = objectAt(payload.token_count) ?? objectAt(payload.usage) ?? payload;
  const total = normalizeTokenBreakdown(
    container.total ?? container.total_token_usage ?? payload.info?.total_token_usage ?? payload.total,
  );
  const last = normalizeTokenBreakdown(
    container.last ?? container.last_token_usage ?? payload.info?.last_token_usage ?? payload.last,
  );

  if (!total && !last) {
    return null;
  }

  return {
    status: 'observed',
    source: 'codex_token_count',
    total,
    last,
    modelContextWindow: numeric(
      container.modelContextWindow ??
        container.model_context_window ??
        payload.info?.model_context_window ??
        payload.modelContextWindow ??
        payload.model_context_window,
    ),
  };
}

function isTurnRecord(record, payload) {
  return record.type === 'turn_context' || payload.type === 'turn_context';
}

function isMessageRecord(record, payload) {
  const type = payload.type ?? record.type;
  return type === 'message' || type === 'response_item' || (record.type === 'response_item' && payload.role);
}

function isToolCallRecord(record, payload) {
  const type = payload.type ?? record.type;
  return (
    type === 'tool_call' ||
    type === 'function_call' ||
    type === 'collab_tool_call' ||
    record.type === 'collab_tool_call' ||
    (record.type === 'response_item' && Boolean(payload.name))
  );
}

function objectAt(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null;
}

function stringAt(value) {
  return typeof value === 'string' && value ? value : null;
}

function firstString(...values) {
  for (const value of values) {
    const string = stringAt(value);
    if (string) {
      return string;
    }
  }
  return null;
}

function firstNumber(...values) {
  for (const value of values) {
    const number = numeric(value);
    if (number !== null) {
      return number;
    }
  }
  return null;
}
