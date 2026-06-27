import test from 'node:test';
import assert from 'node:assert/strict';

import { extractCodexFacts } from '../../../src/adapters/codex/codex-record-parsers.mjs';

test('does not treat response item ids as session ids', () => {
  const facts = extractCodexFacts({
    type: 'response_item',
    timestamp: '2026-06-27T00:00:00.000Z',
    payload: {
      type: 'function_call',
      id: 'fc_not-a-session-id',
      call_id: 'call_123',
      name: 'exec_command',
    },
  });

  assert.equal(facts.sessionId, null);
  assert.equal(facts.isToolCall, true);
});

test('does treat session_meta payload id as the session id', () => {
  const facts = extractCodexFacts({
    type: 'session_meta',
    timestamp: '2026-06-27T00:00:00.000Z',
    payload: {
      id: '019f-session',
      session_id: '019f-session',
      model_provider: 'openai',
      thread_source: 'user',
    },
  });

  assert.equal(facts.sessionId, '019f-session');
  assert.equal(facts.modelProvider, 'openai');
  assert.equal(facts.threadSource, 'user');
});
