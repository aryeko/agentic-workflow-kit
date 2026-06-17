import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { safeName } from '../src/internal/guards';
import { awaitVerdict, notifyVerdict, registerVerdictWaiter } from '../src/review/verdictInbox';
import type { ReviewVerdict } from '../src/types';

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function tempRunPath(): Promise<string> {
  const runPath = await mkdtemp(path.join(tmpdir(), 'awk-verdict-inbox-'));
  tempRoots.push(runPath);
  await mkdir(path.join(runPath, 'children'), { recursive: true });
  return runPath;
}

async function writeVerdictArtifact(runPath: string, storyId: string, verdict: ReviewVerdict): Promise<void> {
  const artifactPath = path.join(runPath, 'children', `${safeName(storyId)}.verdict.json`);
  await writeFile(artifactPath, `${JSON.stringify(verdict, null, 2)}\n`);
}

describe('verdict inbox', () => {
  it('resolves an in-process waiter when a verdict is notified', async () => {
    const runPath = await tempRunPath();
    const waiter = registerVerdictWaiter(runPath, 'WK001');
    const verdict: ReviewVerdict = { decision: 'PASS', summary: 'looks good' };

    notifyVerdict(runPath, 'WK001', verdict);

    await expect(waiter.promise).resolves.toEqual(verdict);
    waiter.dispose();
  });

  it('awaitVerdict resolves immediately from the in-process fast path', async () => {
    const runPath = await tempRunPath();
    const verdict: ReviewVerdict = { decision: 'BLOCK', findings: [{ title: 'x' }] };

    const pending = awaitVerdict(runPath, 'WK002', { timeoutMs: 5_000 });
    notifyVerdict(runPath, 'WK002', verdict);

    await expect(pending).resolves.toEqual(verdict);
  });

  it('awaitVerdict resolves from a verdict artifact already on disk', async () => {
    const runPath = await tempRunPath();
    const verdict: ReviewVerdict = { decision: 'PASS', loop: 1 };
    await writeVerdictArtifact(runPath, 'WK003', verdict);

    await expect(awaitVerdict(runPath, 'WK003', { timeoutMs: 5_000 })).resolves.toMatchObject({
      decision: 'PASS',
      loop: 1,
    });
  });

  it('awaitVerdict resolves from a verdict artifact written after the wait begins', async () => {
    const runPath = await tempRunPath();
    const verdict: ReviewVerdict = { decision: 'BLOCK' };

    const pending = awaitVerdict(runPath, 'WK004', { timeoutMs: 5_000, pollIntervalMs: 10 });
    await writeVerdictArtifact(runPath, 'WK004', verdict);

    await expect(pending).resolves.toMatchObject({ decision: 'BLOCK' });
  });

  it('awaitVerdict resolves to "timeout" when no verdict appears', async () => {
    const runPath = await tempRunPath();
    await expect(awaitVerdict(runPath, 'WK005', { timeoutMs: 30, pollIntervalMs: 10 })).resolves.toBe('timeout');
  });

  it('awaitVerdict resolves to "aborted" when the signal aborts', async () => {
    const runPath = await tempRunPath();
    const controller = new AbortController();
    const pending = awaitVerdict(runPath, 'WK006', {
      timeoutMs: 5_000,
      pollIntervalMs: 10,
      signal: controller.signal,
    });
    controller.abort();
    await expect(pending).resolves.toBe('aborted');
  });

  it('awaitVerdict resolves to "aborted" when given an already-aborted signal', async () => {
    const runPath = await tempRunPath();
    const controller = new AbortController();
    controller.abort();
    await expect(awaitVerdict(runPath, 'WK007', { timeoutMs: 5_000, signal: controller.signal })).resolves.toBe(
      'aborted',
    );
  });

  it('leaves no dangling timers after settling', async () => {
    const runPath = await tempRunPath();
    // If timers or watchers leaked, vitest would report open handles for these settled waits.
    await expect(awaitVerdict(runPath, 'WK008', { timeoutMs: 20, pollIntervalMs: 5 })).resolves.toBe('timeout');
    const verdict: ReviewVerdict = { decision: 'PASS' };
    const pending = awaitVerdict(runPath, 'WK009', { timeoutMs: 5_000, pollIntervalMs: 5 });
    notifyVerdict(runPath, 'WK009', verdict);
    await expect(pending).resolves.toEqual(verdict);
  });
});
