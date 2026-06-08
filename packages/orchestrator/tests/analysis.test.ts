import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { analyzeWorkflowRun } from '../src/analysis/runAnalyzer';

describe('analyzeWorkflowRun', () => {
  it('summarizes child artifacts and best-effort Codex session metrics', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-analysis-'));
    const runDir = path.join(root, 'runs', 'run-1');
    const sessionRoot = path.join(root, 'sessions');
    await mkdir(path.join(runDir, 'children'), { recursive: true });
    await mkdir(sessionRoot, { recursive: true });

    await writeFile(
      path.join(runDir, 'state.json'),
      JSON.stringify({
        runId: 'run-1',
        status: 'blocked',
        blockedReason: 'A012 returned but status is specced',
      }),
    );
    await writeFile(
      path.join(runDir, 'children', 'A007.json'),
      JSON.stringify({ storyId: 'A007', ok: true, sessionId: 'thread-a007' }),
    );
    await writeFile(
      path.join(runDir, 'children', 'A007.metrics.json'),
      JSON.stringify({ storyId: 'A007', toolCounts: {} }),
    );

    await writeFile(
      path.join(sessionRoot, 'a007.jsonl'),
      [
        JSON.stringify({ type: 'session_meta', payload: { id: 'thread-a007' } }),
        JSON.stringify({
          type: 'response_item',
          payload: { type: 'function_call', name: 'exec_command', arguments: '{}' },
        }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call',
            name: 'spawn_agent',
            arguments: JSON.stringify({ agent_type: 'workflow_reviewer' }),
          },
        }),
        JSON.stringify({
          type: 'event_msg',
          payload: {
            type: 'token_count',
            info: {
              total_token_usage: {
                input_tokens: 100,
                cached_input_tokens: 80,
                output_tokens: 10,
                reasoning_output_tokens: 2,
                total_tokens: 110,
              },
            },
          },
        }),
      ].join('\n'),
    );

    const analysis = await analyzeWorkflowRun(runDir, { sessionRoots: [sessionRoot] });

    expect(analysis.runId).toBe('run-1');
    expect(analysis.status).toBe('blocked');
    expect(analysis.children).toHaveLength(1);
    expect(analysis.children[0].sessionLogPath).toBe(path.join(sessionRoot, 'a007.jsonl'));
    expect(analysis.commandCounts.exec_command).toBe(1);
    expect(analysis.subagentCounts.workflow_reviewer).toBe(1);
    expect(analysis.tokenTotals?.totalTokens).toBe(110);
  });

  it('handles runs without child result artifacts', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-analysis-empty-'));
    const runDir = path.join(root, 'runs', 'run-1');
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, 'state.json'), JSON.stringify({ runId: 'run-1', status: 'dry-run' }));

    const analysis = await analyzeWorkflowRun(runDir, { sessionRoots: [] });

    expect(analysis.children).toEqual([]);
    expect(analysis.tokenTotals).toBeNull();
  });

  it('derives supervision_lost from running launch-only artifacts', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-analysis-lost-'));
    const runDir = path.join(root, 'runs', 'run-1');
    await mkdir(path.join(runDir, 'children'), { recursive: true });
    await writeFile(
      path.join(runDir, 'state.json'),
      JSON.stringify({ runId: 'run-1', status: 'running', active: ['A001'] }),
    );
    await writeFile(
      path.join(runDir, 'children', 'A001.launch.json'),
      JSON.stringify({
        storyId: 'A001',
        launchId: 'launch-a001',
        status: 'launched',
        expectedBranch: 't/a001-story',
        expectedWorktreePath: '/repo/.worktrees/t/a001-story',
        sessionId: null,
      }),
    );

    const analysis = await analyzeWorkflowRun(runDir, { sessionRoots: [] });

    expect(analysis.derivedStatus).toBe('supervision_lost');
    expect(analysis.children[0]).toMatchObject({
      storyId: 'A001',
      status: 'supervision_lost',
      expectedBranch: 't/a001-story',
    });
    expect(analysis.issues).toContain('A001 has launch metadata but no settled child result');
  });
});
