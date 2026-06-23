import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);
const importScriptPath = path.join(
  process.cwd(),
  '.agents/skills/delivery-retro/scripts/import-session-observability.mjs',
);
const summarizeScriptPath = path.join(
  process.cwd(),
  '.agents/skills/delivery-retro/scripts/summarize-delivery-observability.mjs',
);
const observeScriptPath = path.join(process.cwd(), '.agents/skills/delivery-retro/scripts/observe-delivery-run.mjs');

type ScriptResult = {
  code: number;
  stdout: string;
  stderr: string;
};

const runScript = async (scriptPath: string, args: string[]): Promise<ScriptResult> => {
  try {
    const result = await execFileAsync(process.execPath, [scriptPath, ...args], {
      cwd: process.cwd(),
      maxBuffer: 1024 * 1024,
    });

    return { code: 0, stdout: result.stdout, stderr: result.stderr };
  } catch (error) {
    const failure = error as Error & { code?: number; stdout?: string; stderr?: string };
    return {
      code: typeof failure.code === 'number' ? failure.code : 1,
      stdout: failure.stdout ?? '',
      stderr: failure.stderr ?? failure.message,
    };
  }
};

const withFixture = async <T>(fn: (fixtureRoot: string) => Promise<T>): Promise<T> => {
  const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'delivery-retro-observability-'));
  try {
    return await fn(fixtureRoot);
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true });
  }
};

const writeSession = async (fixtureRoot: string): Promise<string> => {
  const sessionPath = path.join(fixtureRoot, 'rollout-demo.jsonl');
  await mkdir(fixtureRoot, { recursive: true });
  const records = [
    {
      timestamp: '2026-06-23T10:00:00.000Z',
      type: 'response_item',
      payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'Start Epic 2.' }] },
    },
    {
      timestamp: '2026-06-23T10:00:05.000Z',
      type: 'response_item',
      payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Planning.' }] },
    },
    {
      timestamp: '2026-06-23T10:01:00.000Z',
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: {
          total_token_usage: {
            input_tokens: 100,
            cached_input_tokens: 20,
            output_tokens: 10,
            reasoning_output_tokens: 5,
            total_tokens: 115,
          },
        },
      },
    },
    {
      timestamp: '2026-06-23T10:02:00.000Z',
      type: 'response_item',
      payload: {
        type: 'function_call',
        name: 'spawn_agent',
        call_id: 'call_impl',
        arguments: JSON.stringify({
          agent_type: 'worker',
          model: 'gpt-5.4',
          reasoning_effort: 'medium',
          message: 'Alias: impl-s1\n\nTask: implement `prov-00-s1-capability-attestation`.\nReview scope afterwards.',
        }),
      },
    },
    {
      timestamp: '2026-06-23T10:02:01.000Z',
      type: 'response_item',
      payload: {
        type: 'function_call_output',
        call_id: 'call_impl',
        output: JSON.stringify({ agent_id: '019ef0d1-9537-7eb0-856a-e6eb46e11d05', nickname: 'Maxwell' }),
      },
    },
    {
      timestamp: '2026-06-23T10:07:00.000Z',
      type: 'response_item',
      payload: {
        type: 'function_call_output',
        output: JSON.stringify({
          status: {
            '019ef0d1-9537-7eb0-856a-e6eb46e11d05': {
              completed:
                'CHANGES_REQUESTED\n\n**Medium:** AC-1 evidence missing. Required fix: add public import test.',
            },
          },
        }),
      },
    },
    {
      timestamp: '2026-06-23T10:09:00.000Z',
      type: 'response_item',
      payload: {
        type: 'function_call_output',
        output: JSON.stringify({
          status: {
            '019ef0d1-9537-7eb0-856a-e6eb46e11d05': {
              completed: 'APPROVED\n\nNo required changes remain.',
            },
          },
        }),
      },
    },
    {
      timestamp: '2026-06-23T10:10:00.000Z',
      type: 'event_msg',
      payload: {
        type: 'token_count',
        info: {
          total_token_usage: {
            input_tokens: 200,
            cached_input_tokens: 40,
            output_tokens: 25,
            reasoning_output_tokens: 7,
            total_tokens: 232,
          },
        },
      },
    },
  ];
  await writeFile(sessionPath, `${records.map((record) => JSON.stringify(record)).join('\n')}\n`);
  return sessionPath;
};

describe('delivery observability import and summary', () => {
  it('imports session JSONL into normalized events with turn counts', async () => {
    await withFixture(async (fixtureRoot) => {
      const sessionPath = await writeSession(fixtureRoot);

      const result = await runScript(importScriptPath, ['--session-jsonl', sessionPath, '--format', 'jsonl']);
      expect(result).toMatchObject({ code: 0 });

      const events = result.stdout
        .trim()
        .split('\n')
        .map((line) => JSON.parse(line));

      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'turn_observed', role: 'user', turnIndex: 1 }),
          expect.objectContaining({ type: 'turn_observed', role: 'assistant', turnIndex: 2 }),
          expect.objectContaining({
            type: 'worker_spawned',
            worker: expect.objectContaining({
              alias: 'impl-s1',
              agentId: '019ef0d1-9537-7eb0-856a-e6eb46e11d05',
              storyId: 'prov-00-s1-capability-attestation',
              role: 'implementer',
            }),
          }),
          expect.objectContaining({
            type: 'review_completed',
            verdict: 'changes_requested',
            findings: [expect.objectContaining({ class: 'ac-miss' })],
          }),
          expect.objectContaining({ type: 'review_completed', verdict: 'approved' }),
          expect.objectContaining({
            type: 'token_usage_observed',
            usage: expect.objectContaining({ total: 232, input: 200, output: 25, reasoning: 7 }),
          }),
        ]),
      );
    });
  });

  it('summarizes normalized observability without reading the raw session', async () => {
    await withFixture(async (fixtureRoot) => {
      const sessionPath = await writeSession(fixtureRoot);
      const eventsPath = path.join(fixtureRoot, 'events.jsonl');
      const importResult = await runScript(importScriptPath, [
        '--session-jsonl',
        sessionPath,
        '--output',
        eventsPath,
        '--format',
        'json',
      ]);
      expect(importResult).toMatchObject({ code: 0 });

      const summaryResult = await runScript(summarizeScriptPath, ['--events', eventsPath, '--format', 'json']);
      expect(summaryResult).toMatchObject({ code: 0 });
      const summary = JSON.parse(summaryResult.stdout);

      expect(summary).toMatchObject({
        status: 'ok',
        source: { eventsPath, rawSessionParsed: false },
        turns: { total: 2, byRole: { user: 1, assistant: 1 } },
        tokens: { status: 'observed', total: 232, input: 200, output: 25, reasoning: 7 },
        workers: { total: 1 },
        reviews: { total: 2, changesRequested: 1, approved: 1 },
        findings: { byClass: { 'ac-miss': 1 } },
      });
    });
  });

  it('appends direct observability events for future runs', async () => {
    await withFixture(async (fixtureRoot) => {
      const eventsPath = path.join(fixtureRoot, 'events.jsonl');

      const first = await runScript(observeScriptPath, [
        '--events',
        eventsPath,
        '--type',
        'turn_observed',
        '--payload',
        JSON.stringify({ role: 'user', turnIndex: 1 }),
        '--run-id',
        'run-demo',
      ]);
      expect(first).toMatchObject({ code: 0 });

      const second = await runScript(observeScriptPath, [
        '--events',
        eventsPath,
        '--type',
        'token_usage_observed',
        '--payload',
        JSON.stringify({ usage: { input: 5, cachedInput: 0, output: 3, reasoning: 1, total: 9 } }),
        '--run-id',
        'run-demo',
      ]);
      expect(second).toMatchObject({ code: 0 });

      const summaryResult = await runScript(summarizeScriptPath, ['--events', eventsPath, '--format', 'json']);
      const summary = JSON.parse(summaryResult.stdout);

      expect(summary).toMatchObject({
        turns: { total: 1, byRole: { user: 1 } },
        tokens: { status: 'observed', total: 9 },
      });
    });
  });

  it('rejects payloads that attempt to override reserved event fields', async () => {
    await withFixture(async (fixtureRoot) => {
      const eventsPath = path.join(fixtureRoot, 'events.jsonl');

      const result = await runScript(observeScriptPath, [
        '--events',
        eventsPath,
        '--type',
        'turn_observed',
        '--payload',
        JSON.stringify({ role: 'user', type: 'token_usage_observed' }),
        '--run-id',
        'run-demo',
      ]);

      expect(result.code).toBe(1);
      expect(result.stderr).toContain('reserved event field');
    });
  });

  it('rejects token usage events that are not cumulative snapshots', async () => {
    await withFixture(async (fixtureRoot) => {
      const eventsPath = path.join(fixtureRoot, 'events.jsonl');

      const first = await runScript(observeScriptPath, [
        '--events',
        eventsPath,
        '--type',
        'token_usage_observed',
        '--payload',
        JSON.stringify({ usage: { input: 10, cachedInput: 0, output: 5, reasoning: 1, total: 16 } }),
        '--run-id',
        'run-demo',
      ]);
      expect(first).toMatchObject({ code: 0 });

      const second = await runScript(observeScriptPath, [
        '--events',
        eventsPath,
        '--type',
        'token_usage_observed',
        '--payload',
        JSON.stringify({ usage: { input: 1, cachedInput: 0, output: 1, reasoning: 0, total: 2 } }),
        '--run-id',
        'run-demo',
      ]);

      expect(second.code).toBe(1);
      expect(second.stderr).toContain('must be cumulative');
    });
  });
});
