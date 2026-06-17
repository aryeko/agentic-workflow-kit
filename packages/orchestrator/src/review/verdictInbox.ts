import { type FSWatcher, watch } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isRecord, safeName } from '../internal/guards.js';
import type { ReviewDecision, ReviewVerdict } from '../types.js';

/**
 * In-process verdict inbox. The supervisor (NEXT task) and the Codex driver both import this
 * neutral module so a deposited pre-PR review verdict can wake a waiting supervisor without a
 * drivers -> runner dependency.
 *
 * Two delivery routes are supported:
 *  - In-process fast path: `notifyVerdict` resolves a registered waiter immediately.
 *  - Durable / cross-process route: `awaitVerdict` also reads the verdict artifact
 *    (`<runPath>/children/<safeName(storyId)>.verdict.json`) so a verdict deposited by a
 *    different process is still observed.
 */

const DEFAULT_POLL_INTERVAL_MS = 250;

export type AwaitVerdictOutcome = ReviewVerdict | 'timeout' | 'aborted';

export interface VerdictWaiter {
  promise: Promise<ReviewVerdict>;
  dispose(): void;
}

interface RegisteredWaiter {
  resolve(verdict: ReviewVerdict): void;
}

const waiters = new Map<string, Set<RegisteredWaiter>>();

function waiterKey(runPath: string, storyId: string): string {
  return `${path.resolve(runPath)}::${storyId}`;
}

function verdictArtifactPath(runPath: string, storyId: string): string {
  return path.join(path.resolve(runPath), 'children', `${safeName(storyId)}.verdict.json`);
}

const REVIEW_DECISIONS: ReadonlySet<ReviewDecision> = new Set<ReviewDecision>(['PASS', 'BLOCK']);

function isReviewVerdict(value: unknown): value is ReviewVerdict {
  return (
    isRecord(value) && typeof value.decision === 'string' && REVIEW_DECISIONS.has(value.decision as ReviewDecision)
  );
}

/**
 * Register an in-process waiter for a verdict. Returns the awaited promise plus a `dispose`
 * to drop the waiter without resolving (callers MUST dispose if they stop waiting).
 */
export function registerVerdictWaiter(runPath: string, storyId: string): VerdictWaiter {
  const key = waiterKey(runPath, storyId);
  let entry: RegisteredWaiter | null = null;
  const promise = new Promise<ReviewVerdict>((resolve) => {
    entry = { resolve };
  });
  const waiter = entry as unknown as RegisteredWaiter;
  const bucket = waiters.get(key) ?? new Set<RegisteredWaiter>();
  bucket.add(waiter);
  waiters.set(key, bucket);

  const dispose = (): void => {
    const current = waiters.get(key);
    if (!current) return;
    current.delete(waiter);
    if (current.size === 0) waiters.delete(key);
  };

  return { promise, dispose };
}

/**
 * Resolve any registered in-process waiters for `(runPath, storyId)`. No-op when none exist.
 */
export function notifyVerdict(runPath: string, storyId: string, verdict: ReviewVerdict): void {
  const key = waiterKey(runPath, storyId);
  const bucket = waiters.get(key);
  if (!bucket || bucket.size === 0) return;
  const pending = [...bucket];
  waiters.delete(key);
  for (const waiter of pending) {
    waiter.resolve(verdict);
  }
}

async function readVerdictArtifact(artifactPath: string): Promise<ReviewVerdict | null> {
  try {
    const parsed = JSON.parse(await readFile(artifactPath, 'utf8')) as unknown;
    return isReviewVerdict(parsed) ? parsed : null;
  } catch {
    // Missing file, partial write, or malformed JSON: treat as "not yet available".
    return null;
  }
}

/**
 * Wait for a verdict via either the in-process waiter or the on-disk artifact, racing against a
 * timeout and an optional abort signal. Always cleans up watchers, timers, and the waiter Map
 * entry before settling.
 */
export async function awaitVerdict(
  runPath: string,
  storyId: string,
  opts: { timeoutMs: number; signal?: AbortSignal; pollIntervalMs?: number },
): Promise<AwaitVerdictOutcome> {
  const artifactPath = verdictArtifactPath(runPath, storyId);
  const pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;

  const waiter = registerVerdictWaiter(runPath, storyId);
  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let fsWatcher: FSWatcher | null = null;
  let abortListener: (() => void) | null = null;
  let settled = false;

  const cleanup = (): void => {
    waiter.dispose();
    if (timeoutTimer) clearTimeout(timeoutTimer);
    if (pollTimer) clearInterval(pollTimer);
    if (fsWatcher) fsWatcher.close();
    if (abortListener && opts.signal) opts.signal.removeEventListener('abort', abortListener);
  };

  return await new Promise<AwaitVerdictOutcome>((resolve) => {
    const settle = (outcome: AwaitVerdictOutcome): void => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(outcome);
    };

    if (opts.signal?.aborted) {
      settle('aborted');
      return;
    }

    void waiter.promise.then((verdict) => settle(verdict));

    const checkArtifact = async (): Promise<void> => {
      if (settled) return;
      const verdict = await readVerdictArtifact(artifactPath);
      if (verdict) settle(verdict);
    };

    // Watch the children directory for the verdict artifact appearing (durable/cross-process route).
    try {
      fsWatcher = watch(path.dirname(artifactPath), () => {
        void checkArtifact();
      });
    } catch {
      fsWatcher = null;
    }

    // Bounded poll fallback covers fs.watch gaps (some platforms/filesystems miss events).
    pollTimer = setInterval(() => {
      void checkArtifact();
    }, pollIntervalMs);

    if (opts.signal) {
      abortListener = () => settle('aborted');
      opts.signal.addEventListener('abort', abortListener);
    }

    timeoutTimer = setTimeout(() => settle('timeout'), opts.timeoutMs);

    // Initial read covers an artifact already on disk before the wait began.
    void checkArtifact();
  });
}
