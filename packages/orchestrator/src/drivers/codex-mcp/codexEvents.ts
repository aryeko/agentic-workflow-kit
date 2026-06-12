import { isRecord } from '../../internal/guards.js';

export interface CodexEventNotification {
  method: 'codex/event';
  requestId: string | number | null;
  threadId: string | null;
  eventType: string;
  sessionId: string | null;
  sessionLogPath: string | null;
  cwd: string | null;
  raw: Record<string, unknown>;
}

export function parseCodexEventNotification(value: unknown): CodexEventNotification | null {
  if (!isRecord(value) || value.method !== 'codex/event') return null;
  const params = isRecord(value.params) ? value.params : {};
  const meta = isRecord(params._meta) ? params._meta : {};
  const msg = isRecord(params.msg) ? params.msg : {};
  const metaThreadId = readString(meta.threadId);
  const msgThreadId = readString(msg.thread_id);
  const msgSessionId = readString(msg.session_id);

  return {
    method: 'codex/event',
    requestId: readString(meta.requestId) ?? readNumber(meta.requestId),
    threadId: metaThreadId ?? msgThreadId ?? msgSessionId,
    eventType: readString(msg.type) ?? 'unknown',
    sessionId: msgSessionId,
    sessionLogPath: readString(msg.rollout_path),
    cwd: readString(msg.cwd),
    raw: value,
  };
}

export function codexProgressMessage(event: CodexEventNotification): string {
  return event.eventType === 'unknown' ? 'codex event' : `codex event: ${event.eventType}`;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
