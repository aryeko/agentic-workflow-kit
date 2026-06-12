import { describe, expect, it } from 'vitest';
import { parseCodexEventNotification } from '../src/drivers/codex-mcp/codexEvents';

describe('parseCodexEventNotification', () => {
  it('returns null for non codex event notifications', () => {
    expect(parseCodexEventNotification({ jsonrpc: '2.0', method: 'notifications/progress', params: {} })).toBeNull();
    expect(parseCodexEventNotification({ method: 'codex/other', params: {} })).toBeNull();
    expect(parseCodexEventNotification(null)).toBeNull();
  });

  it('extracts session linkage fields from session_configured', () => {
    const parsed = parseCodexEventNotification({
      jsonrpc: '2.0',
      method: 'codex/event',
      params: {
        _meta: { requestId: 'req-1', threadId: 'thread-meta' },
        msg: {
          type: 'session_configured',
          thread_id: 'thread-msg',
          session_id: 'session-msg',
          rollout_path: '/Users/me/.codex/sessions/run.jsonl',
          cwd: '/repo/.worktrees/a001-story',
        },
      },
    });

    expect(parsed).toMatchObject({
      method: 'codex/event',
      requestId: 'req-1',
      threadId: 'thread-meta',
      sessionId: 'session-msg',
      eventType: 'session_configured',
      sessionLogPath: '/Users/me/.codex/sessions/run.jsonl',
      cwd: '/repo/.worktrees/a001-story',
    });
  });

  it('falls back from meta thread id to message ids', () => {
    expect(
      parseCodexEventNotification({
        method: 'codex/event',
        params: { msg: { type: 'task_started', thread_id: 'thread-msg', session_id: 'session-msg' } },
      })?.threadId,
    ).toBe('thread-msg');

    expect(
      parseCodexEventNotification({
        method: 'codex/event',
        params: { msg: { type: 'task_started', session_id: 'session-msg' } },
      })?.threadId,
    ).toBe('session-msg');
  });

  it('tolerates malformed notifications without throwing', () => {
    expect(parseCodexEventNotification({ method: 'codex/event', params: { msg: 'bad' } })).toMatchObject({
      method: 'codex/event',
      requestId: null,
      threadId: null,
      sessionId: null,
      eventType: 'unknown',
      sessionLogPath: null,
      cwd: null,
    });
  });
});
