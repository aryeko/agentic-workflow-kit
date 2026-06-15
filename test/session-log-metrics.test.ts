import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  analyzeSessionLogMetrics,
  mapSessionLogsByThread,
} from '../packages/orchestrator/src/metrics/sessionLogMetrics.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('session log metrics', () => {
  it('extracts command counts, subagent counts, and token totals', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-session-metrics-'));
    tempRoots.push(root);
    const logPath = path.join(root, 'session.jsonl');
    await writeFile(
      logPath,
      [
        JSON.stringify({ type: 'session_meta', payload: { id: '019e-child' } }),
        JSON.stringify({ type: 'response_item', payload: { type: 'function_call', name: 'exec_command' } }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call',
            name: 'spawn_agent',
            arguments: JSON.stringify({ agent_type: 'reviewer' }),
          },
        }),
        JSON.stringify({ type: 'response_item', payload: { type: 'custom_tool_call', name: 'apply_patch' } }),
        JSON.stringify({
          type: 'event_msg',
          payload: {
            type: 'token_count',
            info: {
              total_token_usage: {
                input_tokens: 100,
                cached_input_tokens: 80,
                output_tokens: 20,
                reasoning_output_tokens: 7,
                total_tokens: 127,
              },
            },
          },
        }),
      ].join('\n'),
    );

    const metrics = await analyzeSessionLogMetrics(logPath);

    expect(metrics.commandCounts).toEqual({ exec_command: 1, spawn_agent: 1, apply_patch: 1 });
    expect(metrics.failedToolCalls).toBe(0);
    expect(metrics.subagentCounts).toEqual({ reviewer: 1 });
    expect(metrics.tokenTotals).toEqual({
      inputTokens: 100,
      cachedInputTokens: 80,
      outputTokens: 20,
      reasoningOutputTokens: 7,
      totalTokens: 127,
    });
  });

  it('extracts failed tool-call counts from non-zero exit and structured error outputs', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-session-failed-tools-'));
    tempRoots.push(root);
    const logPath = path.join(root, 'session.jsonl');
    await writeFile(
      logPath,
      [
        JSON.stringify({
          type: 'response_item',
          payload: { type: 'function_call', name: 'exec_command', call_id: 'call-1' },
        }),
        JSON.stringify({
          type: 'response_item',
          payload: { type: 'function_call_output', call_id: 'call-1', output: 'Process exited with code 1\n' },
        }),
        JSON.stringify({
          type: 'response_item',
          payload: { type: 'function_call', name: 'spawn_agent', call_id: 'call-2' },
        }),
        JSON.stringify({
          type: 'response_item',
          payload: { type: 'function_call_output', call_id: 'call-2', output: JSON.stringify({ error: 'invalid' }) },
        }),
        JSON.stringify({
          type: 'response_item',
          payload: { type: 'function_call', name: 'exec_command', call_id: 'call-3' },
        }),
        JSON.stringify({
          type: 'response_item',
          payload: { type: 'function_call_output', call_id: 'call-3', output: 'Process exited with code 0\n' },
        }),
      ].join('\n'),
    );

    const metrics = await analyzeSessionLogMetrics(logPath);

    expect(metrics.commandCounts).toEqual({ exec_command: 2, spawn_agent: 1 });
    expect(metrics.failedToolCalls).toBe(2);
  });

  it('maps session ids to log paths', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-session-map-'));
    tempRoots.push(root);
    const day = path.join(root, '2026/06/13');
    await mkdir(day, { recursive: true });
    const logPath = path.join(day, 'rollout.jsonl');
    await writeFile(logPath, JSON.stringify({ type: 'session_meta', payload: { id: '019e-child' } }));

    const map = await mapSessionLogsByThread([logPath]);

    expect(map.get('019e-child')).toBe(logPath);
  });

  it('extracts review subagent loops with nullable continuity fields from session logs', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-session-review-metrics-'));
    tempRoots.push(root);
    const logPath = path.join(root, 'session.jsonl');
    await writeFile(
      logPath,
      [
        JSON.stringify({ type: 'session_meta', payload: { id: '019e-child' } }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call',
            name: 'spawn_agent',
            call_id: 'spawn-1',
            arguments: JSON.stringify({
              agent_type: 'reviewer',
              message: 'Run the configured pre-PR review and return findings.',
            }),
          },
        }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call_output',
            call_id: 'spawn-1',
            output: JSON.stringify({ target: 'reviewer-1' }),
          },
        }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call',
            name: 'wait_agent',
            call_id: 'wait-1',
            arguments: JSON.stringify({ targets: ['reviewer-1'] }),
          },
        }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call_output',
            call_id: 'wait-1',
            output: JSON.stringify({
              status: {
                'reviewer-1': {
                  completed: 'PASS: no findings',
                },
              },
            }),
          },
        }),
      ].join('\n'),
    );

    const metrics = await analyzeSessionLogMetrics(logPath);

    expect(metrics.reviewLoops).toEqual([
      {
        loop: 1,
        mode: 'subagent',
        status: 'passed',
        findings: 0,
        agentId: 'reviewer-1',
        previousAgentId: null,
        continuityMode: null,
      },
    ]);
  });
});
