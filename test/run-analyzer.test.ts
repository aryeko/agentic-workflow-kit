import { mkdirSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { analyzeWorkflowRun } from '../packages/orchestrator/src/analysis/runAnalyzer.js';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('run analyzer', () => {
  it('analyzes interactive implement-next journals without child output files', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-analyze-'));
    tempRoots.push(root);
    const runDirectory = path.join(root, 'repo/.codex/agentic-workflow-kit/runs/2026-06-07T12-00-00-000Z');
    const sessionRoot = path.join(root, 'sessions');
    mkdirSync(runDirectory, { recursive: true });
    mkdirSync(path.join(sessionRoot, '2026/06/07'), { recursive: true });

    writeFileSync(
      path.join(runDirectory, 'state.json'),
      JSON.stringify(
        {
          runId: '2026-06-07T12-00-00-000Z',
          command: 'implement-next',
          status: 'complete',
          blockedReason: null,
          interactive: {
            storyId: 'PLD01',
            ok: true,
            sessionId: '019e-run-session',
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      path.join(sessionRoot, '2026/06/07/session.jsonl'),
      [
        JSON.stringify({ type: 'session_meta', payload: { id: '019e-run-session' } }),
        JSON.stringify({ type: 'response_item', payload: { type: 'function_call', name: 'exec_command' } }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call',
            name: 'spawn_agent',
            arguments: JSON.stringify({ agent_type: 'reviewer' }),
          },
        }),
        JSON.stringify({
          type: 'event_msg',
          payload: {
            type: 'token_count',
            info: {
              total_token_usage: {
                input_tokens: 10,
                cached_input_tokens: 2,
                output_tokens: 5,
                reasoning_output_tokens: 3,
                total_tokens: 18,
              },
            },
          },
        }),
      ].join('\n'),
    );

    const analysis = await analyzeWorkflowRun(runDirectory, { sessionRoots: [sessionRoot] });

    expect(analysis.children).toEqual([
      {
        storyId: 'PLD01',
        ok: true,
        sessionId: '019e-run-session',
        sessionLogPath: path.join(sessionRoot, '2026/06/07/session.jsonl'),
      },
    ]);
    expect(analysis.commandCounts).toEqual({ exec_command: 1, spawn_agent: 1 });
    expect(analysis.subagentCounts).toEqual({ reviewer: 1 });
    expect(analysis.tokenTotals?.totalTokens).toBe(18);
  });
});
