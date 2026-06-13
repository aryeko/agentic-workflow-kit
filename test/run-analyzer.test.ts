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
  it('exposes normalized artifact evidence when summary, rows, budgets, and transcripts exist', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-analyze-artifacts-'));
    tempRoots.push(root);
    const runDirectory = path.join(root, 'repo/.codex/agentic-workflow-kit/runs/run-1');
    mkdirSync(runDirectory, { recursive: true });

    writeFileSync(
      path.join(runDirectory, 'state.json'),
      JSON.stringify(
        {
          runId: 'run-1',
          command: 'run-story',
          status: 'complete',
          blockedReason: null,
          completed: [],
        },
        null,
        2,
      ),
    );
    writeFileSync(path.join(runDirectory, 'events.ndjson'), '');
    writeFileSync(
      path.join(runDirectory, 'summary.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          artifactPaths: { summary: 'summary.json', rows: 'rows.json', budgets: 'budgets.json' },
          unavailable: { 'aggregate.tokenTotals': 'session log token telemetry is unavailable' },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      path.join(runDirectory, 'rows.json'),
      JSON.stringify({ schemaVersion: 1, rows: [{ storyId: 'A001' }, { storyId: 'A002' }] }, null, 2),
    );
    writeFileSync(
      path.join(runDirectory, 'budgets.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          evaluations: [
            {
              profileName: 'storyImplementer',
              taskType: 'implementStory',
              dimension: 'toolCalls',
              status: 'unavailable',
              eventType: null,
              unavailableReason: 'session log metrics are unavailable',
            },
            {
              profileName: 'storyImplementer',
              taskType: 'implementStory',
              dimension: 'wallMs',
              status: 'limit-reached',
              eventType: 'budget-stop',
              unavailableReason: null,
            },
          ],
        },
        null,
        2,
      ),
    );
    writeFileSync(
      path.join(runDirectory, 'transcripts.json'),
      JSON.stringify(
        {
          schemaVersion: 1,
          transcripts: [
            { storyId: 'A001', status: 'linked' },
            { storyId: 'A002', status: 'missing' },
            { storyId: 'A003', status: 'unlinked' },
          ],
        },
        null,
        2,
      ),
    );

    const analysis = await analyzeWorkflowRun(runDirectory, { sessionRoots: [] });

    expect(analysis.artifacts).toMatchObject({
      summary: {
        present: true,
        schemaVersion: 1,
        artifactPaths: ['summary.json', 'rows.json', 'budgets.json'],
        unavailable: { 'aggregate.tokenTotals': 'session log token telemetry is unavailable' },
      },
      rows: { present: true, schemaVersion: 1, count: 2, storyIds: ['A001', 'A002'] },
      budgets: {
        present: true,
        schemaVersion: 1,
        evaluationCount: 2,
        unavailable: [
          {
            profileName: 'storyImplementer',
            dimension: 'toolCalls',
            status: 'unavailable',
            unavailableReason: 'session log metrics are unavailable',
          },
        ],
        stops: [{ profileName: 'storyImplementer', dimension: 'wallMs', eventType: 'budget-stop' }],
      },
      transcripts: { present: true, schemaVersion: 1, count: 3, linked: 1, missing: 1, unlinked: 1 },
    });
  });

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
        linkageStatus: 'linked',
        diagnosticSessionCandidates: [],
        metricsStatus: 'available',
        status: 'settled',
        expectedBranch: null,
        expectedWorktreePath: null,
        failedSpawnAgentAttempts: 0,
        recoveryEvents: [],
        completionAuthority: null,
        completionAuthoritySource: null,
        staleParentSnapshot: false,
        progress: {
          lastSupervisorPollAt: null,
          lastObservedChildProgressAt: null,
          progressSource: null,
        },
        verification: [],
        merge: {
          merged: false,
          prNumber: null,
          prUrl: null,
          mergeCommit: null,
          mergedAt: null,
          branchDeleted: null,
        },
        review: {
          prePr: null,
          pr: null,
        },
      },
    ]);
    expect(analysis.commandCounts).toEqual({ exec_command: 1, spawn_agent: 1 });
    expect(analysis.subagentCounts).toEqual({ reviewer: 1 });
    expect(analysis.tokenTotals?.totalTokens).toBe(18);
  });

  it('uses explicit interactive sessionLogPath when sessionId is unavailable', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-analyze-session-path-'));
    tempRoots.push(root);
    const runDirectory = path.join(root, 'repo/.codex/agentic-workflow-kit/runs/2026-06-11T10-00-00-000Z');
    const sessionLogPath = path.join(root, 'explicit-session.jsonl');
    mkdirSync(runDirectory, { recursive: true });

    writeFileSync(
      path.join(runDirectory, 'state.json'),
      JSON.stringify(
        {
          runId: '2026-06-11T10-00-00-000Z',
          command: 'implement-next',
          status: 'complete',
          blockedReason: null,
          interactive: {
            storyId: 'PLD06',
            ok: true,
            sessionId: null,
            sessionLogPath,
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      sessionLogPath,
      [
        JSON.stringify({ type: 'session_meta', payload: { id: '019e-explicit-session' } }),
        JSON.stringify({ type: 'response_item', payload: { type: 'function_call', name: 'exec_command' } }),
      ].join('\n'),
    );

    const analysis = await analyzeWorkflowRun(runDirectory, { sessionRoots: [] });

    expect(analysis.children[0]).toMatchObject({
      storyId: 'PLD06',
      sessionId: null,
      sessionLogPath,
      metricsStatus: 'available',
    });
    expect(analysis.commandCounts).toEqual({ exec_command: 1 });
  });

  it('reconstructs PLD05-style review loops, PR follow-up, and merge aliases', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-analyze-pld05-'));
    tempRoots.push(root);
    const runDirectory = path.join(root, 'repo/.codex/agentic-workflow-kit/runs/2026-06-10T19-29-14Z');
    mkdirSync(runDirectory, { recursive: true });

    writeFileSync(
      path.join(runDirectory, 'state.json'),
      JSON.stringify(
        {
          runId: '2026-06-10T19-29-14Z',
          command: 'implement-next',
          status: 'complete',
          blockedReason: null,
          interactive: {
            storyId: 'PLD05',
            ok: true,
            sessionId: null,
            sessionLogPath: null,
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      path.join(runDirectory, 'config.resolved.json'),
      JSON.stringify(
        {
          implement: {
            review: {
              prePr: { enabled: true, mode: 'subagent', maxLoops: 2, loopMode: 'incremental' },
            },
          },
          pr: { review: { rerequestAfterFix: false } },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      path.join(runDirectory, 'events.ndjson'),
      [
        JSON.stringify({
          recordedAt: '2026-06-10T20:47:45Z',
          eventAt: '2026-06-10T20:47:45Z',
          type: 'pre_pr_review_started',
          mode: 'subagent',
        }),
        JSON.stringify({
          recordedAt: '2026-06-10T19:55:29Z',
          eventAt: '2026-06-10T19:55:29Z',
          type: 'pre_pr_review_blocked',
          mode: 'subagent',
          findings: ['Missing no-focus impression telemetry', 'Payload privacy not enforced'],
        }),
        JSON.stringify({
          recordedAt: '2026-06-10T19:55:29Z',
          eventAt: '2026-06-10T19:55:29Z',
          type: 'pre_pr_review_fix_batch_applied',
          summary: 'Added telemetry and payload whitelisting.',
        }),
        JSON.stringify({
          recordedAt: '2026-06-10T20:03:11Z',
          eventAt: '2026-06-10T20:03:11Z',
          type: 'pre_pr_review_blocked',
          mode: 'subagent',
          findings: ['Nested payload keys were still bypassable'],
        }),
        JSON.stringify({
          recordedAt: '2026-06-10T20:03:11Z',
          eventAt: '2026-06-10T20:03:11Z',
          type: 'pre_pr_review_fix_batch_applied',
          summary: 'Rebuilt nested payload objects from allowlists.',
        }),
        JSON.stringify({
          recordedAt: '2026-06-10T20:03:11Z',
          eventAt: '2026-06-10T20:03:11Z',
          type: 'pre_pr_review_passed',
          mode: 'subagent',
          agentId: '019eb312-b931-7c30-ad5d-7cc2c2dc5bcf',
        }),
        JSON.stringify({
          recordedAt: '2026-06-10T20:13:32Z',
          eventAt: '2026-06-10T20:13:32Z',
          type: 'codex_pr_review_thread_resolved',
          threadId: 'PRRT_kwDOSspRQ86ImuNt',
          fixCommit: 'db68ad9',
        }),
        JSON.stringify({
          recordedAt: '2026-06-10T20:13:32Z',
          eventAt: '2026-06-10T20:13:32Z',
          type: 'pr_merged',
          url: 'https://github.com/aryeko/pathway/pull/86',
        }),
      ].join('\n'),
    );

    const analysis = await analyzeWorkflowRun(runDirectory, { sessionRoots: [] });
    const prePr = analysis.review.prePr as typeof analysis.review.prePr & {
      fixBatchCount: number;
      maxLoopsReached: boolean;
    };
    const pr = analysis.review.pr as typeof analysis.review.pr & { resolvedThreadCount: number };

    expect(analysis.issues.filter((issue) => issue.includes('pre-PR review blocked'))).toEqual([]);
    expect(prePr.status).toBe('passed');
    expect(prePr.fixBatchCount).toBe(2);
    expect(prePr.maxLoopsReached).toBe(false);
    expect(prePr.loops).toEqual([
      {
        loop: 1,
        mode: 'subagent',
        status: 'findings',
        findings: 2,
        agentId: null,
        previousAgentId: null,
        continuityMode: null,
      },
      {
        loop: 2,
        mode: 'subagent',
        status: 'findings',
        findings: 1,
        agentId: null,
        previousAgentId: null,
        continuityMode: null,
      },
      {
        loop: 2,
        mode: 'subagent',
        status: 'passed',
        findings: 0,
        agentId: '019eb312-b931-7c30-ad5d-7cc2c2dc5bcf',
        previousAgentId: null,
        continuityMode: null,
      },
    ]);
    expect(prePr.subagent).toEqual({ agentId: '019eb312-b931-7c30-ad5d-7cc2c2dc5bcf', status: 'passed' });
    expect(pr.fixBatchCount).toBe(1);
    expect(pr.resolvedThreadCount).toBe(1);
    expect(analysis.merge.merged).toBe(true);
    expect(analysis.children[0]?.sessionId).toBeNull();
    expect(analysis.children[0]?.sessionLogPath).toBeNull();
    expect(analysis.children[0]?.metricsStatus).toBe('session_linkage_unavailable');
    expect(analysis.timeline.map((event) => event.type)).toEqual([
      'pre_pr_review_started',
      'pre_pr_review_blocked',
      'pre_pr_review_fix_batch_applied',
      'pre_pr_review_blocked',
      'pre_pr_review_fix_batch_applied',
      'pre_pr_review_passed',
      'codex_pr_review_thread_resolved',
      'pr_merged',
    ]);
  });

  it('preserves local pre-PR review continuity fields in analyzer loop output', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-analyze-review-continuity-'));
    tempRoots.push(root);
    const runDirectory = path.join(root, 'repo/.codex/agentic-workflow-kit/runs/review-continuity');
    mkdirSync(runDirectory, { recursive: true });

    writeFileSync(
      path.join(runDirectory, 'state.json'),
      JSON.stringify(
        {
          runId: 'review-continuity',
          command: 'implement-next',
          status: 'complete',
          blockedReason: null,
          interactive: {
            storyId: 'AWK081',
            ok: true,
            sessionId: null,
            sessionLogPath: null,
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      path.join(runDirectory, 'config.resolved.json'),
      JSON.stringify(
        {
          implement: {
            review: {
              prePr: { enabled: true, mode: 'subagent', maxLoops: 2, loopMode: 'incremental' },
            },
          },
          pr: { review: { rerequestAfterFix: false } },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      path.join(runDirectory, 'events.ndjson'),
      [
        JSON.stringify({
          recordedAt: '2026-06-14T10:00:00Z',
          eventAt: '2026-06-14T10:00:00Z',
          type: 'pre_pr_review_completed',
          loop: 1,
          mode: 'subagent',
          agentId: 'reviewer-1',
          continuityMode: 'full-context',
          verdict: 'BLOCK',
          findings: ['Loop 1 finding'],
        }),
        JSON.stringify({
          recordedAt: '2026-06-14T10:05:00Z',
          eventAt: '2026-06-14T10:05:00Z',
          type: 'pre_pr_review_fix_batch_applied',
        }),
        JSON.stringify({
          recordedAt: '2026-06-14T10:10:00Z',
          eventAt: '2026-06-14T10:10:00Z',
          type: 'pre_pr_review_findings',
          loop: 2,
          mode: 'subagent',
          agentId: 'reviewer-1',
          previousAgentId: 'reviewer-1',
          continuityMode: 'reused-agent',
          findings: ['Loop 2 finding'],
        }),
        JSON.stringify({
          recordedAt: '2026-06-14T10:15:00Z',
          eventAt: '2026-06-14T10:15:00Z',
          type: 'pre_pr_review_fix_batch_applied',
        }),
        JSON.stringify({
          recordedAt: '2026-06-14T10:20:00Z',
          eventAt: '2026-06-14T10:20:00Z',
          type: 'pre_pr_review_completed',
          loop: 3,
          mode: 'subagent',
          agentId: 'reviewer-2',
          previousAgentId: 'reviewer-1',
          continuityMode: 'new-agent-incremental-context',
          verdict: 'PASS',
          findings: [],
        }),
      ].join('\n'),
    );

    const analysis = await analyzeWorkflowRun(runDirectory, { sessionRoots: [] });

    expect(analysis.review.prePr.loops).toEqual([
      {
        loop: 1,
        mode: 'subagent',
        status: 'findings',
        findings: 1,
        agentId: 'reviewer-1',
        previousAgentId: null,
        continuityMode: 'full-context',
      },
      {
        loop: 2,
        mode: 'subagent',
        status: 'findings',
        findings: 1,
        agentId: 'reviewer-1',
        previousAgentId: 'reviewer-1',
        continuityMode: 'reused-agent',
      },
      {
        loop: 3,
        mode: 'subagent',
        status: 'passed',
        findings: 0,
        agentId: 'reviewer-2',
        previousAgentId: 'reviewer-1',
        continuityMode: 'new-agent-incremental-context',
      },
    ]);
    expect(analysis.review.prePr.subagent).toEqual({ agentId: 'reviewer-2', status: 'passed' });
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
      'verification_passed',
      'merged',
    ]);
    expect(analysis.issues).toContain(
      'merge timestamp is earlier than recorded final verification after PR review fixes',
    );
  });

  it('keeps the latest PR review fix timestamp when older external events are appended later', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'awk-analyze-latest-fix-'));
    tempRoots.push(root);
    const runDirectory = path.join(root, 'repo/.codex/agentic-workflow-kit/runs/2026-06-11T12-00-00-000Z');
    mkdirSync(runDirectory, { recursive: true });

    writeFileSync(
      path.join(runDirectory, 'state.json'),
      JSON.stringify(
        {
          runId: '2026-06-11T12-00-00-000Z',
          command: 'implement-next',
          status: 'complete',
          blockedReason: null,
          interactive: {
            storyId: 'PLD05',
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
          type: 'pr_review_fix_batch_applied',
          recordedAt: '2026-06-11T12:01:00.000Z',
          eventAt: '2026-06-11T12:30:00.000Z',
        }),
        JSON.stringify({
          type: 'verification_passed',
          recordedAt: '2026-06-11T12:02:00.000Z',
          eventAt: '2026-06-11T12:15:00.000Z',
          phase: 'final',
          command: 'pnpm run check',
        }),
        JSON.stringify({
          type: 'codex_pr_review_thread_resolved',
          recordedAt: '2026-06-11T12:03:00.000Z',
          eventAt: '2026-06-11T12:05:00.000Z',
        }),
        JSON.stringify({
          type: 'pr_merged',
          recordedAt: '2026-06-11T12:04:00.000Z',
          eventAt: '2026-06-11T12:45:00.000Z',
        }),
      ].join('\n'),
    );

    const analysis = await analyzeWorkflowRun(runDirectory, { sessionRoots: [] });

    expect(analysis.review.pr.fixBatchCount).toBe(2);
    expect(analysis.verification.finalPassedAt).toBe('2026-06-11T12:15:00.000Z');
    expect(analysis.issues).toContain('final verification timestamp is earlier than latest PR review fix evidence');
  });
});
