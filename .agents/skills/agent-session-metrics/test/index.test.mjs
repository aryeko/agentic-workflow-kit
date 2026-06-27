import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { analyzeAgentSessionMetrics } from '../src/index.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = join(here, 'fixtures', 'codex');

test('analyzes a nested Codex session tree by default', async () => {
  const report = await analyzeAgentSessionMetrics({
    provider: 'codex',
    target: { kind: 'session-id', sessionId: 'root-tree' },
    providerHome: join(fixtureRoot, 'nested-subagents'),
  });

  assert.equal(report.main.id, 'root-tree');
  assert.equal(report.main.name, 'Root review session');
  assert.equal(report.main.success, true);
  assert.equal(report.main.error, undefined);
  assert.deepEqual(report.main.metrics, {
    durationMs: 10000,
    tokens: {
      in: 1000,
      out: 300,
      cached: 200,
      total: 1300,
    },
    turns: 0,
    toolsCalled: 2,
  });
  assert.deepEqual(
    report.main.children.map((session) => session.id),
    ['child-a', 'child-b'],
  );
  assert.deepEqual(
    report.main.children[0].children.map((session) => session.id),
    ['grandchild-a1'],
  );
});

test('main scope includes only the target session', async () => {
  const report = await analyzeAgentSessionMetrics({
    provider: 'codex',
    target: { kind: 'session-id', sessionId: 'root-tree' },
    providerHome: join(fixtureRoot, 'nested-subagents'),
    scope: 'main',
  });

  assert.equal(report.main.id, 'root-tree');
  assert.deepEqual(report.main.children, []);
  assert.equal(report.main.metrics.tokens.total, 1300);
});

test('children scope excludes the target and includes recursive descendants', async () => {
  const report = await analyzeAgentSessionMetrics({
    provider: 'codex',
    target: { kind: 'session-id', sessionId: 'root-tree' },
    providerHome: join(fixtureRoot, 'nested-subagents'),
    scope: 'children',
  });

  assert.deepEqual(
    report.main.children.flatMap((session) => [session.id, ...session.children.map((child) => child.id)]),
    ['child-a', 'grandchild-a1', 'child-b'],
  );
  assert.equal(report.main.id, 'root-tree');
});

test('main scope does not resolve spawned child session files', async () => {
  const providerHome = await mkdtemp(join(tmpdir(), 'agent-session-metrics-main-'));
  await mkdir(join(providerHome, 'sessions'), { recursive: true });
  await writeFile(
    join(providerHome, 'sessions', 'rollout-root-main-only.jsonl'),
    [
      '{"type":"session_meta","payload":{"id":"root-main-only","role":"root","timestamp":"2026-06-27T01:00:00.000Z"}}',
      '{"type":"collab_tool_call","payload":{"receiverThreadId":"missing-child","timestamp":"2026-06-27T01:00:01.000Z"}}',
      '{"type":"event_msg","payload":{"type":"token_count","timestamp":"2026-06-27T01:00:02.000Z","total":{"total_tokens":10}}}',
      '',
    ].join('\n'),
  );

  const report = await analyzeAgentSessionMetrics({
    provider: 'codex',
    target: { kind: 'session-id', sessionId: 'root-main-only' },
    providerHome,
    scope: 'main',
  });

  assert.deepEqual([report.main.id, ...report.main.children.map((session) => session.id)], ['root-main-only']);
  assert.equal(report.main.metrics.tokens.total, 10);
});

test('tree scope follows spawned session ids instead of sweeping parent links', async () => {
  const providerHome = await mkdtemp(join(tmpdir(), 'agent-session-metrics-tree-'));
  await mkdir(join(providerHome, 'sessions'), { recursive: true });
  await writeFile(
    join(providerHome, 'sessions', 'rollout-root-spawned-only.jsonl'),
    [
      '{"type":"session_meta","payload":{"id":"root-spawned-only","role":"root","timestamp":"2026-06-27T01:00:00.000Z"}}',
      '{"type":"collab_tool_call","payload":{"receiverThreadId":"spawned-child","timestamp":"2026-06-27T01:00:01.000Z"}}',
      '{"type":"event_msg","payload":{"type":"token_count","timestamp":"2026-06-27T01:00:02.000Z","total":{"total_tokens":10}}}',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(providerHome, 'sessions', 'rollout-spawned-child.jsonl'),
    [
      '{"type":"session_meta","payload":{"id":"spawned-child","parentSessionId":"root-spawned-only","depth":1,"role":"child","timestamp":"2026-06-27T01:01:00.000Z"}}',
      '{"type":"event_msg","payload":{"type":"token_count","timestamp":"2026-06-27T01:01:02.000Z","total":{"total_tokens":20}}}',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(providerHome, 'sessions', 'rollout-unspawned-child.jsonl'),
    [
      '{"type":"session_meta","payload":{"id":"unspawned-child","parentSessionId":"root-spawned-only","depth":1,"role":"child","timestamp":"2026-06-27T01:02:00.000Z"}}',
      '{"type":"event_msg","payload":{"type":"token_count","timestamp":"2026-06-27T01:02:02.000Z","total":{"total_tokens":30}}}',
      '',
    ].join('\n'),
  );

  const report = await analyzeAgentSessionMetrics({
    provider: 'codex',
    target: { kind: 'session-id', sessionId: 'root-spawned-only' },
    providerHome,
    scope: 'tree',
  });

  assert.deepEqual(
    [report.main.id, ...report.main.children.map((session) => session.id)],
    ['root-spawned-only', 'spawned-child'],
  );
  assert.equal(report.main.metrics.tokens.total, 10);
  assert.equal(report.main.children[0].metrics.tokens.total, 20);
});

test('tree scope follows plural Codex receiver_thread_ids arrays', async () => {
  const providerHome = await mkdtemp(join(tmpdir(), 'agent-session-metrics-plural-'));
  await mkdir(join(providerHome, 'sessions'), { recursive: true });
  await writeFile(
    join(providerHome, 'sessions', 'rollout-root-plural.jsonl'),
    [
      '{"type":"session_meta","payload":{"id":"root-plural","role":"root","timestamp":"2026-06-27T01:00:00.000Z"}}',
      '{"type":"collab_tool_call","payload":{"receiver_thread_ids":["plural-child"],"timestamp":"2026-06-27T01:00:01.000Z"}}',
      '{"type":"event_msg","payload":{"type":"token_count","timestamp":"2026-06-27T01:00:02.000Z","total":{"total_tokens":10}}}',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(providerHome, 'sessions', 'rollout-plural-child.jsonl'),
    [
      '{"type":"session_meta","payload":{"id":"plural-child","parentSessionId":"root-plural","depth":1,"role":"child","timestamp":"2026-06-27T01:01:00.000Z"}}',
      '{"type":"event_msg","payload":{"type":"token_count","timestamp":"2026-06-27T01:01:02.000Z","total":{"total_tokens":20}}}',
      '',
    ].join('\n'),
  );

  const report = await analyzeAgentSessionMetrics({
    provider: 'codex',
    target: { kind: 'session-id', sessionId: 'root-plural' },
    providerHome,
    scope: 'tree',
  });

  assert.deepEqual(
    [report.main.id, ...report.main.children.map((session) => session.id)],
    ['root-plural', 'plural-child'],
  );
});

test('tree scope follows Codex spawn_agent output agent ids', async () => {
  const providerHome = await mkdtemp(join(tmpdir(), 'agent-session-metrics-spawn-agent-'));
  await mkdir(join(providerHome, 'sessions'), { recursive: true });
  await writeFile(
    join(providerHome, 'sessions', 'rollout-root-spawn-agent.jsonl'),
    [
      '{"type":"session_meta","payload":{"id":"root-spawn-agent","role":"root","timestamp":"2026-06-27T01:00:00.000Z"}}',
      '{"type":"response_item","payload":{"type":"function_call","name":"spawn_agent","call_id":"call_spawn","arguments":"{\\"agent_type\\":\\"worker\\",\\"message\\":\\"Say hi\\"}","timestamp":"2026-06-27T01:00:01.000Z"}}',
      '{"type":"response_item","payload":{"type":"function_call_output","call_id":"call_spawn","output":"{\\"agent_id\\":\\"spawn-agent-child\\",\\"nickname\\":\\"Boole\\"}","timestamp":"2026-06-27T01:00:02.000Z"}}',
      '{"type":"response_item","payload":{"type":"function_call_output","call_id":"call_other","output":"{\\"agent_id\\":\\"decoy-child\\",\\"nickname\\":\\"NotSpawned\\"}","timestamp":"2026-06-27T01:00:02.500Z"}}',
      '{"type":"response_item","payload":{"type":"custom_tool_call","input":"fixture text with \\\\\\"name\\\\\\":\\\\\\"spawn_agent\\\\\\" and \\\\\\"call_id\\\\\\":\\\\\\"call_fixture\\\\\\" plus \\\\\\"agent_id\\\\\\":\\\\\\"fixture-child\\\\\\" and \\\\\\"receiverThreadId\\\\\\":\\\\\\"fixture-child\\\\\\"","timestamp":"2026-06-27T01:00:02.750Z"}}',
      '{"type":"event_msg","payload":{"type":"token_count","timestamp":"2026-06-27T01:00:03.000Z","total":{"total_tokens":10}}}',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(providerHome, 'sessions', 'rollout-spawn-agent-child.jsonl'),
    [
      '{"type":"session_meta","payload":{"id":"spawn-agent-child","parentThreadId":"root-spawn-agent","depth":1,"role":"child","timestamp":"2026-06-27T01:01:00.000Z"}}',
      '{"type":"event_msg","payload":{"type":"token_count","timestamp":"2026-06-27T01:01:02.000Z","total":{"total_tokens":20}}}',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(providerHome, 'sessions', 'rollout-decoy-child.jsonl'),
    [
      '{"type":"session_meta","payload":{"id":"decoy-child","parentThreadId":"root-spawn-agent","depth":1,"role":"child","timestamp":"2026-06-27T01:02:00.000Z"}}',
      '{"type":"event_msg","payload":{"type":"token_count","timestamp":"2026-06-27T01:02:02.000Z","total":{"total_tokens":40}}}',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(providerHome, 'sessions', 'rollout-fixture-child.jsonl'),
    [
      '{"type":"session_meta","payload":{"id":"fixture-child","parentThreadId":"root-spawn-agent","depth":1,"role":"child","timestamp":"2026-06-27T01:03:00.000Z"}}',
      '{"type":"event_msg","payload":{"type":"token_count","timestamp":"2026-06-27T01:03:02.000Z","total":{"total_tokens":80}}}',
      '',
    ].join('\n'),
  );

  const report = await analyzeAgentSessionMetrics({
    provider: 'codex',
    target: { kind: 'session-id', sessionId: 'root-spawn-agent' },
    providerHome,
    scope: 'tree',
  });

  assert.deepEqual(
    [report.main.id, ...report.main.children.map((session) => session.id)],
    ['root-spawn-agent', 'spawn-agent-child'],
  );
  assert.equal(report.main.children[0].metrics.tokens.total, 20);
});
