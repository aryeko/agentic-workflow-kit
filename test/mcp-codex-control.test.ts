import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { abortRunHandler } from '../packages/orchestrator/src/commands/handlers.js';
import type {
  ChildControlRequest,
  ChildControlResult,
  DriverToolStatus,
  StoryRunner,
  StoryRunRequest,
  StoryRunResult,
} from '../packages/orchestrator/src/drivers/StoryRunner.js';
import {
  childReplyJournalFields,
  codexReplyJournalFields,
  resolveChildControlTarget,
  resolveCodexControlTarget,
} from '../packages/orchestrator/src/mcp/codexControl.js';

const tempRoots: string[] = [];

class FakeControlRunner implements StoryRunner {
  abortRequests: ChildControlRequest[] = [];

  async runStory(_request: StoryRunRequest): Promise<StoryRunResult> {
    throw new Error('not used');
  }

  async checkTools(): Promise<DriverToolStatus> {
    return { ok: true, tools: ['fake'] };
  }

  async abort(request: ChildControlRequest): Promise<ChildControlResult> {
    this.abortRequests.push(request);
    return {
      ok: true,
      tool: 'fake_child_interrupt',
      sessionId: request.sessionId ?? 'missing',
      storyId: request.storyId ?? null,
      runPath: request.runPath ?? null,
      rawResult: {},
    };
  }
}

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe('codex MCP control target resolution', () => {
  it('resolves a child session from runPath and storyId', async () => {
    const runPath = await mkdtemp(path.join(tmpdir(), 'awk-control-'));
    tempRoots.push(runPath);
    await mkdir(path.join(runPath, 'children'), { recursive: true });
    await writeFile(
      path.join(runPath, 'children/DLD07.launch.json'),
      JSON.stringify({ storyId: 'DLD07', sessionId: '019e-child', sessionLogPath: '/sessions/dld07.jsonl' }),
    );

    const target = await resolveCodexControlTarget({ runPath, storyId: 'DLD07' });

    expect(target).toEqual({ sessionId: '019e-child', storyId: 'DLD07', runPath });
  });

  it('rejects a run-resolved target without a linked session', async () => {
    const runPath = await mkdtemp(path.join(tmpdir(), 'awk-control-missing-'));
    tempRoots.push(runPath);
    await mkdir(path.join(runPath, 'children'), { recursive: true });
    await writeFile(
      path.join(runPath, 'children/DLD07.launch.json'),
      JSON.stringify({ storyId: 'DLD07', sessionId: null }),
    );

    await expect(resolveCodexControlTarget({ runPath, storyId: 'DLD07' })).rejects.toThrow(
      'story DLD07 does not have a linked Codex session',
    );
  });

  it('does not include reply message previews in journal fields', () => {
    const fields = codexReplyJournalFields('secret token sk-live-123', 'codex_reply');

    expect(fields).toEqual({
      messageSha256: '3fb49f5289846a39350df3f09b5f9e64e06473dc56143fdbe82d68ca6c850a6a',
      tool: 'codex_reply',
    });
    expect(JSON.stringify(fields)).not.toContain('secret');
    expect(JSON.stringify(fields)).not.toContain('sk-live');
  });

  it('exposes neutral child-control aliases with the same target and redaction behavior', async () => {
    const runPath = await mkdtemp(path.join(tmpdir(), 'awk-child-control-'));
    tempRoots.push(runPath);
    await mkdir(path.join(runPath, 'children'), { recursive: true });
    await writeFile(path.join(runPath, 'children/DLD07.launch.json'), JSON.stringify({ sessionId: '019e-child' }));

    await expect(resolveChildControlTarget({ runPath, storyId: 'DLD07' })).resolves.toEqual({
      sessionId: '019e-child',
      storyId: 'DLD07',
      runPath,
    });
    expect(childReplyJournalFields('secret token sk-live-123', 'workflow_child_reply')).toEqual({
      messageSha256: '3fb49f5289846a39350df3f09b5f9e64e06473dc56143fdbe82d68ca6c850a6a',
      tool: 'workflow_child_reply',
    });
  });

  it('classifies abort requests for terminal runs as already terminal', async () => {
    const runPath = await mkdtemp(path.join(tmpdir(), 'awk-control-terminal-'));
    tempRoots.push(runPath);
    await writeFile(
      path.join(runPath, 'state.json'),
      JSON.stringify({
        runId: 'run-1',
        status: 'complete',
        active: [],
        completed: [],
        blockedStoryId: null,
        blockedReason: null,
      }),
    );

    const result = await abortRunHandler({ runPath, reason: 'late stop', requestedBy: 'test' });

    expect(result.outcome).toBe('already-terminal');
    expect(await readFile(path.join(runPath, 'controls.ndjson'), 'utf8')).toContain('"action":"abort"');
  });

  it('classifies active children without linked sessions as unsupported', async () => {
    const runPath = await mkdtemp(path.join(tmpdir(), 'awk-control-unsupported-'));
    tempRoots.push(runPath);
    await mkdir(path.join(runPath, 'children'), { recursive: true });
    await writeFile(
      path.join(runPath, 'state.json'),
      JSON.stringify({
        runId: 'run-1',
        status: 'running',
        active: ['DLD07'],
        completed: [],
        blockedStoryId: null,
        blockedReason: null,
      }),
    );
    await writeFile(
      path.join(runPath, 'children/DLD07.launch.json'),
      JSON.stringify({ storyId: 'DLD07', sessionId: null }),
    );

    const result = await abortRunHandler({ runPath, storyId: 'DLD07', reason: 'operator stop', requestedBy: 'test' });

    expect(result.outcome).toBe('unsupported');
    expect(result.childOutcomes).toEqual([
      {
        storyId: 'DLD07',
        sessionId: null,
        outcome: 'unsupported',
        detail: 'active child has no linked child session',
      },
    ]);
    expect(JSON.parse(await readFile(path.join(runPath, 'state.json'), 'utf8'))).toMatchObject({
      status: 'aborting',
      blockedReason: 'operator stop',
    });
  });

  it('aborts linked active children through the configured story runner contract', async () => {
    const runPath = await mkdtemp(path.join(tmpdir(), 'awk-control-runner-'));
    tempRoots.push(runPath);
    await mkdir(path.join(runPath, 'children'), { recursive: true });
    await writeFile(
      path.join(runPath, 'state.json'),
      JSON.stringify({
        runId: 'run-1',
        status: 'running',
        active: ['DLD07'],
        completed: [],
        blockedStoryId: null,
        blockedReason: null,
      }),
    );
    await writeFile(path.join(runPath, 'children/DLD07.launch.json'), JSON.stringify({ sessionId: '019e-child' }));
    const controlRunner = new FakeControlRunner();

    const result = await abortRunHandler({
      runPath,
      storyId: 'DLD07',
      reason: 'operator stop',
      requestedBy: 'test',
      controlRunner,
    });

    expect(controlRunner.abortRequests).toEqual([
      {
        kind: 'interrupt',
        sessionId: '019e-child',
        storyId: 'DLD07',
        runPath,
        reason: 'operator stop',
      },
    ]);
    expect(result.childOutcomes).toEqual([
      {
        storyId: 'DLD07',
        sessionId: '019e-child',
        outcome: 'requested',
        detail: 'sent fake_child_interrupt',
      },
    ]);
  });

  it('does not abort active children when a targeted story is not active', async () => {
    const runPath = await mkdtemp(path.join(tmpdir(), 'awk-control-unmatched-'));
    tempRoots.push(runPath);
    await mkdir(path.join(runPath, 'children'), { recursive: true });
    await writeFile(
      path.join(runPath, 'state.json'),
      JSON.stringify({
        runId: 'run-1',
        status: 'running',
        active: ['DLD07'],
        completed: [],
        blockedStoryId: null,
        blockedReason: null,
      }),
    );

    const result = await abortRunHandler({ runPath, storyId: 'DLD99', reason: 'operator stop', requestedBy: 'test' });

    expect(result.outcome).toBe('unsupported');
    expect(result.activeStoryIds).toEqual([]);
    expect(result.childOutcomes).toEqual([
      {
        storyId: 'DLD99',
        sessionId: null,
        outcome: 'unsupported',
        detail: 'requested story is not active in this run',
      },
    ]);
    expect(JSON.parse(await readFile(path.join(runPath, 'state.json'), 'utf8'))).toMatchObject({
      status: 'running',
      active: ['DLD07'],
      blockedReason: null,
    });
  });
});
