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
        status: 'settled',
        expectedBranch: null,
        expectedWorktreePath: null,
      },
    ]);
    expect(analysis.commandCounts).toEqual({ exec_command: 1, spawn_agent: 1 });
    expect(analysis.subagentCounts).toEqual({ reviewer: 1 });
    expect(analysis.tokenTotals?.totalTokens).toBe(18);
  });

  it('flags merges that happen before required final verification after review fixes', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-analyze-order-'));
    tempRoots.push(root);
    const runDirectory = path.join(root, 'repo/.codex/agentic-workflow-kit/runs/2026-06-08T18-04-18-300Z');
    mkdirSync(runDirectory, { recursive: true });

    writeFileSync(
      path.join(runDirectory, 'state.json'),
      JSON.stringify(
        {
          runId: '2026-06-08T18-04-18-300Z',
          command: 'implement-next',
          status: 'complete',
          blockedReason: null,
          interactive: {
            storyId: 'PLD04',
            ok: true,
            sessionId: null,
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      path.join(runDirectory, 'events.ndjson'),
      [
        JSON.stringify({
          type: 'pr_review_fix_batch',
          recordedAt: '2026-06-08T18:42:00.000Z',
          eventAt: '2026-06-08T18:40:00.000Z',
          batch: 1,
        }),
        JSON.stringify({
          type: 'verification_passed',
          recordedAt: '2026-06-08T18:45:00.000Z',
          eventAt: '2026-06-08T19:05:00.000Z',
          phase: 'final',
          command: 'pnpm run check',
        }),
        JSON.stringify({
          type: 'merged',
          recordedAt: '2026-06-08T18:50:00.000Z',
          eventAt: '2026-06-08T19:00:00.000Z',
        }),
      ].join('\n'),
    );

    const analysis = await analyzeWorkflowRun(runDirectory, { sessionRoots: [] });

    expect(analysis.review.pr.fixBatchCount).toBe(1);
    expect(analysis.verification.finalPassedAt).toBe('2026-06-08T19:05:00.000Z');
    expect(analysis.merge.mergeBeforeFinalVerification).toBe(true);
    expect(analysis.timeline.map((event) => event.type)).toEqual([
      'pr_review_fix_batch',
      'merged',
      'verification_passed',
    ]);
    expect(analysis.issues).toContain('merge occurred before final verification after PR review fixes completed');
  });
});
