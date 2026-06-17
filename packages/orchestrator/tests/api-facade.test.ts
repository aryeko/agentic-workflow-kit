import { access, mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  projectInspectFacade,
  runPreviewFacade,
  runStatusFacade,
  runSubscribeFacade,
  runSubscriptionPollFacade,
  runUnsubscribeFacade,
  trackerValidateFacade,
} from '../src/api/facade';
import {
  WorkflowConfigError,
  WorkflowInternalError,
  WorkflowRunNotFoundError,
  WorkflowStoryNotEligibleError,
  WorkflowTrackerError,
  workflowKitErrorFromUnknown,
} from '../src/internal/errors';

const trackerMarkdown = `---
title: Linkly tracker
status: approved
owner: —
---

# Linkly

## Status matrix

| ID | Name | Depends on | Wave | Status | Spec | Plan | Owner | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LK01 | Foundation | — | 1 | done | [spec](../../specs/lk01.md) | [plan](../../plans/lk01.md) | — | — |
| LK02 | Pilot | LK01 | 2 | specced | [spec](../../specs/lk02.md) | — | — | — |
| LK03 | Claimed | LK01 | 2 | specced | [spec](../../specs/lk03.md) | — | arye | — |

## Dependency graph

\`\`\`mermaid
flowchart TD
  LK01 --> LK02
\`\`\`
`;

async function createWorkspace(
  options: { secondEligibleTrack?: boolean; duplicateStoryTrack?: boolean } = {},
): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-api-facade-'));
  await mkdir(path.join(root, '.workflow'), { recursive: true });
  await mkdir(path.join(root, 'docs/tracks/linkly'), { recursive: true });
  await writeFile(path.join(root, '.workflow/config.yaml'), 'version: 1\n');
  await writeFile(path.join(root, 'docs/tracks/linkly/README.md'), trackerMarkdown);
  if (options.secondEligibleTrack || options.duplicateStoryTrack) {
    await mkdir(path.join(root, 'docs/tracks/billing'), { recursive: true });
    const billingMarkdown = options.duplicateStoryTrack
      ? trackerMarkdown.replace('title: Linkly tracker', 'title: Billing tracker')
      : trackerMarkdown
          .replace('title: Linkly tracker', 'title: Billing tracker')
          .replaceAll('LK01', 'BL01')
          .replaceAll('LK02', 'BL02')
          .replaceAll('LK03', 'BL03');
    await writeFile(path.join(root, 'docs/tracks/billing/README.md'), billingMarkdown);
  }
  return root;
}

async function createRunWorkspace(config = 'version: 1\n'): Promise<{ root: string; runPath: string }> {
  const root = await createWorkspace();
  await writeFile(path.join(root, '.workflow/config.yaml'), config);
  const runPath = path.join(root, '.codex', 'agentic-workflow-kit', 'runs', 'run-1');
  await mkdir(runPath, { recursive: true });
  await writeFile(
    path.join(runPath, 'state.json'),
    JSON.stringify({
      runId: 'run-1',
      status: 'running',
      active: ['LK02'],
      completed: [],
      blockedStoryId: null,
      blockedReason: null,
    }),
  );
  await writeFile(
    path.join(runPath, 'events.ndjson'),
    `${[
      JSON.stringify({
        recordedAt: '2026-06-17T00:00:00.000Z',
        eventAt: '2026-06-17T00:00:00.000Z',
        type: 'run-started',
        message: 'Started',
      }),
      JSON.stringify({
        recordedAt: '2026-06-17T00:00:01.000Z',
        eventAt: '2026-06-17T00:00:01.000Z',
        type: 'child-progress',
        storyId: 'LK02',
        message: 'Working',
      }),
    ].join('\n')}\n`,
  );
  return { root, runPath };
}

describe('workflow API facade', () => {
  it('returns project inspection in the shared product envelope', async () => {
    const root = await createWorkspace();

    const envelope = await projectInspectFacade({ cwd: root, requestId: 'req-test' });

    expect(envelope).toMatchObject({
      ok: true,
      operation: 'workflow_project_inspect',
      apiVersion: '1',
      requestId: 'req-test',
      project: {
        repoRoot: root,
        configPath: '.workflow/config.yaml',
      },
      result: {
        project: {
          tracksDir: 'docs/tracks',
          tracks: [{ id: 'linkly', title: 'Linkly tracker' }],
        },
        capabilities: {
          authoring: true,
          trackerMigration: true,
          runStory: true,
          runTrack: true,
          streaming: true,
          detachedRunSubscriptions: true,
          abort: true,
          runtimeInfo: true,
          configCompatibility: true,
          github: true,
          githubVerificationConfigured: true,
          githubVerificationAvailable: null,
        },
      },
      warnings: [],
      artifacts: [
        {
          kind: 'config',
          path: '.workflow/config.yaml',
        },
      ],
    });
  });

  it('previews a story run through the shared envelope without changing legacy run handlers', async () => {
    const root = await createWorkspace();

    const envelope = await runPreviewFacade({
      cwd: root,
      requestId: 'req-story',
      target: { type: 'story', trackId: 'linkly', storyId: 'LK02' },
    });

    expect(envelope).toMatchObject({
      ok: true,
      operation: 'workflow_run_preview',
      requestId: 'req-story',
      result: {
        run: {
          id: null,
          status: 'dry-run',
          target: { type: 'story', trackId: 'linkly', storyId: 'LK02' },
        },
        dryRunDispatch: ['LK02'],
        blockers: [],
      },
      artifacts: [],
      next: [
        expect.objectContaining({
          label: 'Start run',
          mcpTool: 'run_story',
        }),
      ],
    });
    await expect(access(path.join(root, '.codex', 'agentic-workflow-kit'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('previews an eligible track run through the same request model', async () => {
    const root = await createWorkspace();

    const envelope = await runPreviewFacade({
      cwd: root,
      target: { type: 'track', trackId: 'linkly', mode: 'eligible' },
    });

    expect(envelope).toMatchObject({
      ok: true,
      operation: 'workflow_run_preview',
      result: {
        run: {
          id: null,
          status: 'dry-run',
          target: { type: 'track', trackId: 'linkly', mode: 'eligible' },
        },
        dryRunDispatch: ['LK02'],
        blockers: [],
      },
    });
  });

  it('honors force for story previews without writing run artifacts', async () => {
    const root = await createWorkspace();

    const envelope = await runPreviewFacade({
      cwd: root,
      force: true,
      target: { type: 'story', trackId: 'linkly', storyId: 'LK03' },
    });

    expect(envelope).toMatchObject({
      ok: true,
      operation: 'workflow_run_preview',
      result: {
        run: {
          id: null,
          status: 'dry-run',
          target: { type: 'story', trackId: 'linkly', storyId: 'LK03' },
        },
        dryRunDispatch: ['LK03'],
        blockers: [],
      },
      artifacts: [],
    });
    await expect(access(path.join(root, '.codex', 'agentic-workflow-kit'))).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('returns a story-not-eligible envelope for non-forced blocked story previews', async () => {
    const root = await createWorkspace();

    const envelope = await runPreviewFacade({
      cwd: root,
      target: { type: 'story', trackId: 'linkly', storyId: 'LK03' },
    });

    expect(envelope).toMatchObject({
      ok: false,
      operation: 'workflow_run_preview',
      error: {
        code: 'STORY_NOT_ELIGIBLE',
        retryable: false,
        message: 'owner is arye',
      },
    });
  });

  it('maps facade failures to a structured error envelope', async () => {
    const root = await createWorkspace();

    const envelope = await runPreviewFacade({
      cwd: root,
      target: { type: 'track', trackId: 'missing', mode: 'eligible' },
    });

    expect(envelope).toMatchObject({
      ok: false,
      operation: 'workflow_run_preview',
      error: {
        code: 'TRACKER_INVALID',
        severity: 'error',
        retryable: false,
        message: expect.stringContaining('track missing was not found'),
      },
      warnings: [],
    });
  });

  it('maps missing story previews to a tracker validation error', async () => {
    const root = await createWorkspace();

    const envelope = await runPreviewFacade({
      cwd: root,
      target: { type: 'story', trackId: 'linkly', storyId: 'LK99' },
    });

    expect(envelope).toMatchObject({
      ok: false,
      operation: 'workflow_run_preview',
      error: {
        code: 'TRACKER_INVALID',
        message: 'target LK99 was not found',
      },
    });
  });

  it('keeps config failures typed before tracker discovery', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-api-facade-no-config-'));

    const envelope = await runPreviewFacade({
      cwd: root,
      target: { type: 'story', storyId: 'LK02' },
    });

    expect(envelope).toMatchObject({
      ok: false,
      operation: 'workflow_run_preview',
      error: {
        code: 'CONFIG_INVALID',
        retryable: false,
      },
    });
  });

  it('keeps config failures typed before run-read fallback classification', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-api-facade-run-no-config-'));

    const envelope = await runStatusFacade({ cwd: root, runId: 'missing-run' });

    expect(envelope).toMatchObject({
      ok: false,
      operation: 'workflow_run_status',
      error: {
        code: 'CONFIG_INVALID',
        retryable: false,
      },
    });
  });

  it('subscribes, polls, and unsubscribes through the product envelope', async () => {
    const { root } = await createRunWorkspace();

    const subscribed = await runSubscribeFacade({
      cwd: root,
      runId: 'run-1',
      subscription: { topics: ['child'], replay: { lastEvents: 0 } },
    });
    expect(subscribed).toMatchObject({
      ok: true,
      operation: 'workflow_run_subscribe',
      apiVersion: '1',
      result: {
        runId: 'run-1',
        committedCursor: 'events.ndjson:0',
        nextCursor: 'events.ndjson:2',
        replay: [],
      },
    });
    if (!subscribed.ok) throw new Error('subscribe failed');

    const polled = await runSubscriptionPollFacade({
      cwd: root,
      runId: 'run-1',
      subscriptionId: subscribed.result.subscriptionId,
      ackCursor: subscribed.result.nextCursor,
    });
    expect(polled).toMatchObject({
      ok: true,
      operation: 'workflow_run_subscription_poll',
      result: { events: [], committedCursor: 'events.ndjson:2' },
    });

    const unsubscribed = await runUnsubscribeFacade({
      cwd: root,
      runId: 'run-1',
      subscriptionId: subscribed.result.subscriptionId,
    });
    expect(unsubscribed).toMatchObject({
      ok: true,
      operation: 'workflow_run_unsubscribe',
      result: { subscriptionId: subscribed.result.subscriptionId, closed: true },
    });
  });

  it('allows absolute runPath poll fallback with CONFIG_UNAVAILABLE warning', async () => {
    const { root, runPath } = await createRunWorkspace();
    const subscribed = await runSubscribeFacade({
      cwd: root,
      runId: 'run-1',
      subscription: { replay: { lastEvents: 0 } },
    });
    if (!subscribed.ok) throw new Error('subscribe failed');

    const polled = await runSubscriptionPollFacade({
      runPath,
      subscriptionId: subscribed.result.subscriptionId,
      ackCursor: subscribed.result.nextCursor,
    });

    expect(polled).toMatchObject({
      ok: true,
      operation: 'workflow_run_subscription_poll',
      warnings: [{ code: 'CONFIG_UNAVAILABLE' }],
      result: { subscriptionId: subscribed.result.subscriptionId },
    });
  });

  it('blocks subscribe-by-runId when config compatibility is unsupported', async () => {
    const { root } = await createRunWorkspace('version: "0.7.0"\n');

    const envelope = await runSubscribeFacade({ cwd: root, runId: 'run-1' });

    expect(envelope).toMatchObject({
      ok: false,
      operation: 'workflow_run_subscribe',
      error: { code: 'CONFIG_INVALID', message: expect.stringContaining('newer than this runtime supports') },
      next: [
        expect.objectContaining({ mcpTool: 'workflow_config_status' }),
        expect.objectContaining({ mcpTool: 'workflow_config_upgrade' }),
      ],
    });
  });

  it('does not mask corrupt run artifacts as missing runs', async () => {
    const root = await createWorkspace();
    const runDir = path.join(root, '.codex', 'agentic-workflow-kit', 'runs', 'run-corrupt');
    await mkdir(runDir, { recursive: true });
    await writeFile(path.join(runDir, 'state.json'), '{');

    const envelope = await runStatusFacade({ cwd: root, runId: 'run-corrupt' });

    expect(envelope).toMatchObject({
      ok: false,
      operation: 'workflow_run_status',
      error: {
        code: 'INTERNAL_ERROR',
        retryable: false,
      },
    });
  });

  it('keeps config failures typed before tracker validation', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-api-facade-tracker-no-config-'));

    const envelope = await trackerValidateFacade({ cwd: root, track: 'linkly' });

    expect(envelope).toMatchObject({
      ok: false,
      operation: 'workflow_tracker_validate',
      error: {
        code: 'CONFIG_INVALID',
        retryable: false,
      },
    });
  });

  it('derives public error metadata from typed errors rather than message text', () => {
    const cases = [
      [new WorkflowConfigError('settings unavailable'), 'CONFIG_INVALID', false],
      [new WorkflowTrackerError('target LK99 unavailable'), 'TRACKER_INVALID', false],
      [new WorkflowStoryNotEligibleError('owner conflict'), 'STORY_NOT_ELIGIBLE', false],
      [new WorkflowRunNotFoundError('artifact directory missing'), 'RUN_NOT_FOUND', false],
      [new WorkflowInternalError('driver boundary failure', { retryable: true }), 'INTERNAL_ERROR', true],
    ] as const;

    for (const [error, code, retryable] of cases) {
      expect(workflowKitErrorFromUnknown(error)).toMatchObject({ code, retryable, message: error.message });
    }
  });

  it('rejects story preview when the story id exists in multiple tracks and no track is supplied', async () => {
    const root = await createWorkspace({ duplicateStoryTrack: true });

    const envelope = await runPreviewFacade({
      cwd: root,
      target: { type: 'story', storyId: 'LK02' },
    });

    expect(envelope).toMatchObject({
      ok: false,
      operation: 'workflow_run_preview',
      error: {
        code: 'TRACKER_INVALID',
        message: expect.stringContaining('story LK02 exists in multiple tracks'),
      },
    });
  });

  it('rejects eligible-track preview when multiple tracks are eligible and no track is supplied', async () => {
    const root = await createWorkspace({ secondEligibleTrack: true });

    const envelope = await runPreviewFacade({
      cwd: root,
      target: { type: 'track', mode: 'eligible' },
    });

    expect(envelope).toMatchObject({
      ok: false,
      operation: 'workflow_run_preview',
      error: {
        code: 'TRACKER_INVALID',
        message: expect.stringContaining('multiple tracks have eligible stories'),
      },
    });
  });
});
