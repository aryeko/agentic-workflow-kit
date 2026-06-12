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

  it('does not classify a launch-only child with recent heartbeat as supervision_lost', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-analysis-active-launch-'));
    const runDir = path.join(root, 'runs', 'run-1');
    await mkdir(path.join(runDir, 'children'), { recursive: true });
    await writeFile(
      path.join(runDir, 'state.json'),
      JSON.stringify({ runId: 'run-1', status: 'running', active: ['A001'] }),
    );
    await writeFile(
      path.join(runDir, 'config.resolved.json'),
      JSON.stringify({ orchestrator: { childTimeoutMs: 1_800_000 } }),
    );
    await writeFile(
      path.join(runDir, 'children', 'A001.launch.json'),
      JSON.stringify({
        storyId: 'A001',
        launchId: 'launch-a001',
        status: 'launched',
        expectedBranch: 't/a001-story',
        expectedWorktreePath: '/repo/.worktrees/t/a001-story',
        startedAt: '2026-06-11T00:00:00.000Z',
        lastHeartbeatAt: '2026-06-11T00:20:00.000Z',
        sessionId: null,
      }),
    );
    await writeFile(
      path.join(runDir, 'events.ndjson'),
      JSON.stringify({
        type: 'child-heartbeat',
        storyId: 'A001',
        launchId: 'launch-a001',
        eventAt: '2026-06-11T00:20:00.000Z',
      }),
    );

    const analysis = await analyzeWorkflowRun(runDir, {
      sessionRoots: [],
      now: '2026-06-11T00:25:00.000Z',
    });

    expect(analysis.derivedStatus).toBe('running');
    expect(analysis.children[0]).toMatchObject({
      storyId: 'A001',
      status: 'launched',
      expectedBranch: 't/a001-story',
    });
    expect(analysis.issues).not.toContain('A001 has launch metadata but no settled child result');
  });

  it('does not classify a launch-only child with recent worktree activity as supervision_lost', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-analysis-active-worktree-'));
    const runDir = path.join(root, 'runs', 'run-1');
    const worktreePath = path.join(root, '.worktrees', 'a001-story');
    await mkdir(path.join(runDir, 'children'), { recursive: true });
    await mkdir(worktreePath, { recursive: true });
    await writeFile(path.join(worktreePath, 'notes.md'), 'recent child activity\n');
    await writeFile(
      path.join(runDir, 'state.json'),
      JSON.stringify({ runId: 'run-1', status: 'running', active: ['A001'] }),
    );
    await writeFile(
      path.join(runDir, 'config.resolved.json'),
      JSON.stringify({ orchestrator: { childTimeoutMs: 1_800_000 } }),
    );
    await writeFile(
      path.join(runDir, 'children', 'A001.launch.json'),
      JSON.stringify({
        storyId: 'A001',
        launchId: 'launch-a001',
        status: 'launched',
        expectedBranch: 't/a001-story',
        expectedWorktreePath: worktreePath,
        startedAt: '2026-06-11T00:00:00.000Z',
        lastHeartbeatAt: null,
        sessionId: null,
      }),
    );

    const analysis = await analyzeWorkflowRun(runDir, {
      sessionRoots: [],
      now: new Date().toISOString(),
    });

    expect(analysis.derivedStatus).toBe('running');
    expect(analysis.children[0]).toMatchObject({ storyId: 'A001', status: 'launched' });
  });

  it('reconstructs pre-PR review loops from child session subagent tool calls', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-analysis-session-review-'));
    const runDir = path.join(root, 'runs', 'run-1');
    const sessionRoot = path.join(root, 'sessions');
    await mkdir(path.join(runDir, 'children'), { recursive: true });
    await mkdir(sessionRoot, { recursive: true });
    await writeFile(
      path.join(runDir, 'state.json'),
      JSON.stringify({ runId: 'run-1', status: 'blocked', blockedReason: null }),
    );
    await writeFile(
      path.join(runDir, 'config.resolved.json'),
      JSON.stringify({
        implement: {
          review: { prePr: { enabled: true, mode: 'subagent', maxLoops: 2, loopMode: 'incremental' } },
        },
      }),
    );
    await writeFile(
      path.join(runDir, 'children', 'A001.json'),
      JSON.stringify({ storyId: 'A001', ok: true, sessionId: 'thread-a001' }),
    );
    await writeFile(
      path.join(sessionRoot, 'a001.jsonl'),
      [
        JSON.stringify({ type: 'session_meta', payload: { id: 'thread-a001' } }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call',
            name: 'spawn_agent',
            call_id: 'spawn-1',
            arguments: JSON.stringify({
              agent_type: 'default',
              prompt: 'Run the configured pre-PR review for A001.',
            }),
          },
        }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call_output',
            call_id: 'spawn-1',
            output: JSON.stringify({ agent_path: 'agent-review-1' }),
          },
        }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call',
            name: 'wait_agent',
            call_id: 'wait-1',
            arguments: JSON.stringify({ targets: ['agent-review-1'] }),
          },
        }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call_output',
            call_id: 'wait-1',
            output: JSON.stringify({
              status: {
                'agent-review-1': {
                  completed:
                    '**Findings**\n\n- **Medium** tests/docs/traceability.test.ts: Missing durable verification evidence.\n- **Medium** docs/closeout.md: Acceptance claim is not verified on a production path.\n- **Low** docs/closeout.md: Stale follow-up note.\n\n**Notes**\n\nI did not edit files.',
                },
              },
            }),
          },
        }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call',
            name: 'spawn_agent',
            call_id: 'spawn-2',
            arguments: JSON.stringify({
              agent_type: 'default',
              prompt: 'Run the incremental pre-PR review after fixes.',
            }),
          },
        }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call_output',
            call_id: 'spawn-2',
            output: JSON.stringify({ agent_path: 'agent-review-2' }),
          },
        }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call',
            name: 'wait_agent',
            call_id: 'wait-2',
            arguments: JSON.stringify({ targets: ['agent-review-2'] }),
          },
        }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call_output',
            call_id: 'wait-2',
            output: JSON.stringify({
              status: { 'agent-review-2': { completed: 'No findings.\n\nVerified focused traceability tests.' } },
            }),
          },
        }),
      ].join('\n'),
    );

    const analysis = await analyzeWorkflowRun(runDir, { sessionRoots: [sessionRoot] });

    expect(analysis.review.prePr).toMatchObject({
      requestedMode: 'subagent',
      actualMode: 'subagent',
      status: 'passed',
      fixBatchCount: 1,
      subagent: { agentId: 'agent-review-2', status: 'passed' },
      loops: [
        { loop: 1, mode: 'subagent', status: 'findings', findings: 3 },
        { loop: 2, mode: 'subagent', status: 'passed', findings: 0 },
      ],
    });
  });

  it('reconstructs review and merge evidence from interactive events without session metadata', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-analysis-events-'));
    const runDir = path.join(root, 'runs', 'run-1');
    await mkdir(runDir, { recursive: true });
    await writeFile(
      path.join(runDir, 'state.json'),
      JSON.stringify({
        runId: 'run-1',
        command: 'implement-next',
        status: 'complete',
        blockedReason: null,
        interactive: { storyId: 'PLD04', ok: true, sessionId: null },
      }),
    );
    await writeFile(
      path.join(runDir, 'config.resolved.json'),
      JSON.stringify({
        implement: {
          review: { prePr: { mode: 'auto', maxLoops: 2, loopMode: 'incremental' } },
        },
        pr: { review: { rerequestAfterFix: false } },
      }),
    );
    await writeFile(
      path.join(runDir, 'events.ndjson'),
      [
        JSON.stringify({
          type: 'pre_pr_review_downgraded',
          ts: '2026-06-08T18:10:00.000Z',
          requestedMode: 'auto',
          actualMode: 'inline',
          reason: 'multi-agent spawn tool requires explicit user request for delegation',
        }),
        JSON.stringify({
          type: 'pre_pr_review_cleared',
          ts: '2026-06-08T18:20:00.000Z',
          actualMode: 'inline',
          loop: 1,
        }),
        JSON.stringify({
          type: 'pre_pr_review_cleared',
          ts: '2026-06-08T18:25:00.000Z',
          actualMode: 'subagent',
          agentId: 'subagent-extra',
          loop: 2,
        }),
        JSON.stringify({
          type: 'pr_review_findings',
          ts: '2026-06-08T18:30:00.000Z',
          findings: [
            {
              severity: 'P2',
              summary: 'Repeated-miss reduction count target is formatted as a percentage',
              file: 'src/dashboard.ts',
            },
          ],
        }),
        JSON.stringify({
          type: 'pr_review_fix_batch',
          ts: '2026-06-08T18:40:00.000Z',
          batch: 1,
          rerequestAfterFix: false,
        }),
        JSON.stringify({
          type: 'verification_passed',
          ts: '2026-06-08T18:50:00.000Z',
          phase: 'final',
          command: 'pnpm run check',
        }),
        JSON.stringify({ type: 'merged', ts: '2026-06-08T19:00:00.000Z' }),
        JSON.stringify({ type: 'cleanup_complete', ts: '2026-06-08T19:05:00.000Z', status: 'complete' }),
      ].join('\n'),
    );

    const analysis = await analyzeWorkflowRun(runDir, { sessionRoots: [] });

    expect(analysis.children[0]).toMatchObject({ storyId: 'PLD04', sessionId: null, sessionLogPath: null });
    expect(analysis.review.prePr).toMatchObject({
      requestedMode: 'auto',
      actualMode: 'subagent',
      status: 'downgraded',
      maxLoops: 2,
      loopMode: 'incremental',
      subagent: { agentId: 'subagent-extra', status: 'passed' },
    });
    expect(analysis.review.prePr.warnings).toContain(
      'pre-PR review downgraded from auto to inline: multi-agent spawn tool requires explicit user request for delegation',
    );
    expect(analysis.review.pr).toMatchObject({
      fixBatchCount: 1,
      rerequestAfterFix: false,
      findings: [
        {
          severity: 'P2',
          summary: 'Repeated-miss reduction count target is formatted as a percentage',
          file: 'src/dashboard.ts',
        },
      ],
    });
    expect(analysis.verification.finalPassedAt).toBe('2026-06-08T18:50:00.000Z');
    expect(analysis.merge).toMatchObject({
      merged: true,
      mergedAt: '2026-06-08T19:00:00.000Z',
      cleanupStatus: 'complete',
      mergeBeforeFinalVerification: false,
    });
    expect(analysis.timeline.map((event) => event.type)).toEqual([
      'pre_pr_review_downgraded',
      'pre_pr_review_cleared',
      'pre_pr_review_cleared',
      'pr_review_findings',
      'pr_review_fix_batch',
      'verification_passed',
      'merged',
      'cleanup_complete',
    ]);
    expect(analysis.issues).toContain(
      'pre-PR review downgraded from auto to inline: multi-agent spawn tool requires explicit user request for delegation',
    );
  });

  it('treats disabled pre-PR review policy as not configured', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-analysis-disabled-review-'));
    const runDir = path.join(root, 'runs', 'run-1');
    await mkdir(runDir, { recursive: true });
    await writeFile(
      path.join(runDir, 'state.json'),
      JSON.stringify({
        runId: 'run-1',
        command: 'implement-next',
        status: 'complete',
        interactive: { storyId: 'WK01', ok: true, sessionId: null },
      }),
    );
    await writeFile(
      path.join(runDir, 'config.resolved.json'),
      JSON.stringify({
        implement: {
          review: { prePr: { enabled: false, mode: 'auto', maxLoops: 2, loopMode: 'incremental' } },
        },
      }),
    );

    const analysis = await analyzeWorkflowRun(runDir, { sessionRoots: [] });

    expect(analysis.review.prePr).toMatchObject({
      requestedMode: null,
      actualMode: null,
      status: 'not_configured',
      maxLoops: null,
      loopMode: null,
    });
  });

  it('reconstructs real PLD04-style legacy event journals', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-analysis-pld04-'));
    const runDir = path.join(root, 'runs', '2026-06-08T18-04-18-300Z');
    await mkdir(runDir, { recursive: true });
    await writeFile(
      path.join(runDir, 'state.json'),
      JSON.stringify({
        runId: '2026-06-08T18-04-18-300Z',
        command: 'implement-next',
        status: 'complete',
        blockedReason: null,
        interactive: { storyId: 'PLD04', ok: true, sessionId: null },
      }),
    );
    await writeFile(
      path.join(runDir, 'config.resolved.json'),
      JSON.stringify({
        implement: {
          review: { prePr: { enabled: true, mode: 'auto', maxLoops: 2, loopMode: 'incremental' } },
        },
        pr: { review: { rerequestAfterFix: false } },
      }),
    );
    await writeFile(
      path.join(runDir, 'events.ndjson'),
      [
        JSON.stringify({
          time: '2026-06-08T18:39:10.000Z',
          event: 'verification_passed',
          commands: ['pnpm run check:turbo', 'pnpm run check'],
        }),
        JSON.stringify({
          time: '2026-06-08T18:39:20.000Z',
          event: 'pre_pr_review_downgraded',
          from: 'auto-subagent',
          to: 'inline',
          reason: 'multi-agent spawn tool requires explicit user request for delegation',
        }),
        JSON.stringify({
          time: '2026-06-08T18:39:25.000Z',
          event: 'pre_pr_review_started',
          mode: 'inline',
        }),
        JSON.stringify({
          time: '2026-06-08T18:43:10.000Z',
          event: 'pre_pr_review_cleared',
          mode: 'inline',
          findings: [],
        }),
        JSON.stringify({
          time: '2026-06-08T18:52:30.000Z',
          event: 'pre_pr_review_cleared',
          mode: 'subagent-extra',
          findings: [],
          agentId: '019ea877-eba0-77b0-a0e8-22eeac24ba3b',
        }),
        JSON.stringify({
          time: '2026-06-08T18:55:05.000Z',
          event: 'pr_review_findings',
          findings: [
            {
              priority: 'P2',
              url: 'https://github.com/aryeko/pathway/pull/83#discussion_r3375446828',
              summary: 'Dashboard goal labels converted count target 1 into 100 for repeated-miss reduction.',
            },
          ],
        }),
        JSON.stringify({
          time: '2026-06-08T18:58:20.000Z',
          event: 'pr_review_fix_pushed',
          verification: ['pnpm run check:turbo', 'pre-push typecheck'],
        }),
        JSON.stringify({
          time: '2026-06-08T19:00:35.000Z',
          event: 'verification_passed',
          commands: ['pnpm run check'],
          afterReviewFix: true,
        }),
        JSON.stringify({
          time: '2026-06-08T18:58:35.000Z',
          event: 'merged',
        }),
        JSON.stringify({
          time: '2026-06-08T19:01:15.000Z',
          event: 'cleanup_complete',
        }),
      ].join('\n'),
    );

    const analysis = await analyzeWorkflowRun(runDir, { sessionRoots: [] });

    expect(analysis.timeline.map((event) => event.type)).toEqual([
      'verification_passed',
      'pre_pr_review_downgraded',
      'pre_pr_review_started',
      'pre_pr_review_cleared',
      'pre_pr_review_cleared',
      'pr_review_findings',
      'pr_review_fix_pushed',
      'verification_passed',
      'merged',
      'cleanup_complete',
    ]);
    expect(analysis.review.prePr).toMatchObject({
      requestedMode: 'auto-subagent',
      actualMode: 'subagent-extra',
      status: 'downgraded',
      subagent: { agentId: '019ea877-eba0-77b0-a0e8-22eeac24ba3b', status: 'passed' },
    });
    expect(analysis.review.pr).toMatchObject({
      fixBatchCount: 1,
      rerequestAfterFix: false,
      findings: [
        {
          severity: 'P2',
          summary: 'Dashboard goal labels converted count target 1 into 100 for repeated-miss reduction.',
          file: null,
        },
      ],
    });
    expect(analysis.verification.commands).toEqual([
      {
        phase: null,
        command: 'pnpm run check:turbo',
        status: 'passed',
        eventAt: '2026-06-08T18:39:10.000Z',
      },
      {
        phase: null,
        command: 'pnpm run check',
        status: 'passed',
        eventAt: '2026-06-08T18:39:10.000Z',
      },
      {
        phase: null,
        command: 'pnpm run check:turbo',
        status: 'passed',
        eventAt: '2026-06-08T18:58:20.000Z',
      },
      {
        phase: null,
        command: 'pre-push typecheck',
        status: 'passed',
        eventAt: '2026-06-08T18:58:20.000Z',
      },
      {
        phase: 'final',
        command: 'pnpm run check',
        status: 'passed',
        eventAt: '2026-06-08T19:00:35.000Z',
      },
    ]);
    expect(analysis.verification.finalPassedAt).toBe('2026-06-08T19:00:35.000Z');
    expect(analysis.merge).toMatchObject({
      merged: true,
      mergedAt: '2026-06-08T18:58:35.000Z',
      cleanupStatus: 'complete',
      mergeBeforeFinalVerification: true,
    });
    expect(analysis.issues).toContain(
      'merge timestamp is earlier than recorded final verification after PR review fixes',
    );
  });

  it('reports per-child linkage, failed subagent spawn, recovery, and completion authority details', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-analysis-details-'));
    const runDir = path.join(root, 'runs', 'run-1');
    const sessionRoot = path.join(root, 'sessions');
    await mkdir(path.join(runDir, 'children'), { recursive: true });
    await mkdir(sessionRoot, { recursive: true });
    await writeFile(
      path.join(runDir, 'state.json'),
      JSON.stringify({ runId: 'run-1', status: 'blocked', blockedReason: 'manual recovery required' }),
    );
    await writeFile(
      path.join(runDir, 'config.resolved.json'),
      JSON.stringify({
        orchestrator: { childNoProgressTimeoutMs: 1_800_000 },
        pr: { review: { rerequestAfterFix: false } },
      }),
    );
    await writeFile(
      path.join(runDir, 'children', 'PLD10.launch.json'),
      JSON.stringify({
        storyId: 'PLD10',
        launchId: 'launch-pld10',
        status: 'supervision_lost',
        expectedBranch: 'personalized-learning-dashboard/pld10-recommendation-controls-ui',
        expectedWorktreePath: path.join(root, '.worktrees/pld10-recommendation-controls-ui'),
        sessionId: null,
      }),
    );
    await writeFile(
      path.join(runDir, 'events.ndjson'),
      [
        JSON.stringify({
          type: 'session_candidate',
          storyId: 'PLD10',
          sessionId: '019eb471-c9ef-7600-9ef9-f6b726855553',
          evidence: 'matched launch time, story id, and worktree',
        }),
        JSON.stringify({
          type: 'parent_takeover_blocked',
          storyId: 'PLD10',
          decision: 'manual_recovery_required',
          evidence: ['session 019eb471-c9ef-7600-9ef9-f6b726855553 has recent heartbeat', 'PR #91 is open'],
        }),
        JSON.stringify({
          type: 'completion_authority',
          storyId: 'PLD10',
          authority: 'merged-pr-on-base',
        }),
        JSON.stringify({
          type: 'pr_review_fix_batch',
          storyId: 'PLD10',
          batch: 1,
          rerequestAfterFix: false,
        }),
      ].join('\n'),
    );
    await writeFile(
      path.join(sessionRoot, 'pld10.jsonl'),
      [
        JSON.stringify({ type: 'session_meta', payload: { id: '019eb471-c9ef-7600-9ef9-f6b726855553' } }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call',
            name: 'spawn_agent',
            call_id: 'spawn-bad',
            arguments: JSON.stringify({ message: 'bad', items: [] }),
          },
        }),
        JSON.stringify({
          type: 'response_item',
          payload: {
            type: 'function_call_output',
            call_id: 'spawn-bad',
            output: 'tool error: provide either message or items, not both',
          },
        }),
      ].join('\n'),
    );

    const analysis = await analyzeWorkflowRun(runDir, { sessionRoots: [sessionRoot] });

    expect(analysis.children[0]).toMatchObject({
      storyId: 'PLD10',
      linkageStatus: 'diagnostic_candidate_only',
      diagnosticSessionCandidates: [
        {
          sessionId: '019eb471-c9ef-7600-9ef9-f6b726855553',
          evidence: 'matched launch time, story id, and worktree',
        },
      ],
      failedSpawnAgentAttempts: 1,
      completionAuthority: 'merged-pr-on-base',
      recoveryEvents: [
        {
          type: 'parent_takeover_blocked',
          decision: 'manual_recovery_required',
          evidence: ['session 019eb471-c9ef-7600-9ef9-f6b726855553 has recent heartbeat', 'PR #91 is open'],
        },
      ],
    });
    expect(analysis.review.pr).toMatchObject({ fixBatchCount: 1, rerequestAfterFix: false });
  });

  it('explains SSS-shaped stale parent snapshots with per-story merged evidence', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-analysis-sss-'));
    const runDir = path.join(root, 'runs', '2026-06-11T19-47-30-255Z');
    await mkdir(path.join(runDir, 'children'), { recursive: true });
    await mkdir(path.join(runDir, 'stories'), { recursive: true });
    await writeFile(
      path.join(runDir, 'state.json'),
      JSON.stringify({
        runId: '2026-06-11T19-47-30-255Z',
        command: 'run-eligible',
        status: 'blocked',
        blockedReason: 'SSS02 returned but status is implementing',
        completed: [
          { storyId: 'SSS02', ok: true, sessionId: 'thread-sss02', returnedStatus: 'implementing' },
          { storyId: 'SSS04', ok: true, sessionId: 'thread-sss04', returnedStatus: 'implementing' },
        ],
      }),
    );
    await writeFile(
      path.join(runDir, 'config.resolved.json'),
      JSON.stringify({
        statuses: { eligible: ['specced'], complete: ['done'] },
        orchestrator: { childNoProgressTimeoutMs: 1_800_000 },
        implement: { review: { prePr: { enabled: true, mode: 'subagent', maxLoops: 2, loopMode: 'incremental' } } },
        pr: { review: { rerequestAfterFix: false } },
      }),
    );
    for (const storyId of ['SSS02', 'SSS04']) {
      await writeFile(
        path.join(runDir, 'children', `${storyId}.launch.json`),
        JSON.stringify({
          storyId,
          launchId: `${storyId}-launch`,
          status: 'settled',
          expectedBranch: `smart-session-summary/${storyId.toLowerCase()}`,
          expectedWorktreePath: path.join(root, '.worktrees', storyId.toLowerCase()),
          startedAt: '2026-06-11T19:47:30.000Z',
          lastSupervisorPollAt: storyId === 'SSS04' ? '2026-06-11T20:10:00.000Z' : null,
          lastObservedChildProgressAt: null,
          progressSource: null,
          sessionId: `thread-${storyId.toLowerCase()}`,
        }),
      );
      await writeFile(
        path.join(runDir, 'children', `${storyId}.json`),
        JSON.stringify({
          storyId,
          ok: true,
          sessionId: `thread-${storyId.toLowerCase()}`,
          returnedStatus: 'implementing',
          returnedComplete: false,
          completionAuthority: 'tracker-status-not-complete',
          evidence: {
            finalStatus: 'done',
            trackerPath: 'docs/tracks/smart-session-summary/README.md',
            prNumber: storyId === 'SSS02' ? 100 : 101,
            prUrl: `https://github.com/aryeko/pathway/pull/${storyId === 'SSS02' ? 100 : 101}`,
            merged: true,
            mergeCommit: storyId === 'SSS02' ? 'ece0fdb' : '6015a17',
            branchDeleted: true,
            verification: [{ command: 'pnpm run check', status: 'passed', phase: 'final' }],
            prePrReview: { loops: storyId === 'SSS04' ? 2 : 1, status: 'passed' },
            prReview: { findings: storyId === 'SSS04' ? 1 : 0, resolved: true },
          },
        }),
      );
    }
    await writeFile(
      path.join(runDir, 'stories', 'after-SSS04.json'),
      JSON.stringify([
        { id: 'SSS02', status: 'implementing' },
        { id: 'SSS04', status: 'implementing' },
        { id: 'SSS05', status: 'specced', blockedReason: 'dependencies are not complete: SSS02, SSS04' },
      ]),
    );
    await writeFile(
      path.join(runDir, 'events.ndjson'),
      [
        JSON.stringify({
          type: 'child-supervisor-poll',
          storyId: 'SSS04',
          eventAt: '2026-06-11T20:10:00.000Z',
        }),
        JSON.stringify({
          type: 'completion_authority',
          storyId: 'SSS02',
          authority: 'tracker-status-not-complete',
          source: 'returned-tracker',
        }),
        JSON.stringify({
          type: 'completion_authority',
          storyId: 'SSS04',
          authority: 'tracker-status-not-complete',
          source: 'returned-tracker',
        }),
      ].join('\n'),
    );

    const analysis = await analyzeWorkflowRun(runDir, { sessionRoots: [] });

    expect(analysis.status).toBe('blocked');
    expect(analysis.derivedStatus).toBe('complete');
    expect(analysis.issues).toContain(
      'SSS02 parent tracker snapshot is stale: returned status implementing but child evidence reports merged done',
    );
    expect(analysis.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          storyId: 'SSS02',
          staleParentSnapshot: true,
          completionAuthority: 'tracker-status-not-complete',
          completionAuthoritySource: 'returned-tracker',
          progress: {
            lastSupervisorPollAt: null,
            lastObservedChildProgressAt: null,
            progressSource: null,
          },
          merge: {
            merged: true,
            prNumber: 100,
            prUrl: 'https://github.com/aryeko/pathway/pull/100',
            mergeCommit: 'ece0fdb',
            mergedAt: null,
            branchDeleted: true,
          },
          verification: [{ command: 'pnpm run check', status: 'passed', phase: 'final', detail: null }],
        }),
        expect.objectContaining({
          storyId: 'SSS04',
          staleParentSnapshot: true,
          progress: {
            lastSupervisorPollAt: '2026-06-11T20:10:00.000Z',
            lastObservedChildProgressAt: null,
            progressSource: null,
          },
          review: {
            prePr: { loops: 2, status: 'passed' },
            pr: { findings: 1, resolved: true },
          },
        }),
      ]),
    );
  });
});
