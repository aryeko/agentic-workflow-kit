import { constants } from 'node:fs';
import { access, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { isNodeError, isRecord, safeName } from '../internal/guards.js';
import type { ResolvedWorkflowConfig, WorkflowStory } from '../types.js';
import { parseTrackerStories, updateTrackerStoryRow } from './markdownTracker.js';

export type TrackerClaimResult =
  | { ok: true; story: WorkflowStory }
  | { ok: false; reason: string; story?: WorkflowStory };

export type TrackerReleaseResult =
  | { ok: true; fromStatus: string; toStatus: string }
  | { ok: false; reason: string; story?: WorkflowStory };

const CLAIM_LOCK_TIMEOUT_MS = 5000;
const CLAIM_LOCK_STALE_AFTER_MS = 5 * 60 * 1000;

interface ClaimLockMetadata {
  owner: string;
  pid: number;
  createdAt: string;
}

export async function trackerFileExists(config: ResolvedWorkflowConfig, story: WorkflowStory): Promise<boolean> {
  try {
    await access(trackerPath(config, story), constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function claimTrackerRow(args: {
  config: ResolvedWorkflowConfig;
  story: WorkflowStory;
  owner: string;
  force?: boolean;
}): Promise<TrackerClaimResult> {
  const filePath = trackerPath(args.config, args.story);
  const context = {
    completeStatuses: new Set(args.config.statuses.complete),
    eligibleStatuses: new Set(args.config.statuses.eligible),
    idPattern: new RegExp(args.config.tracker.idPattern),
    trackId: args.story.metadata.trackId,
    trackTitle: args.story.metadata.trackTitle,
    trackerPath: args.story.metadata.trackerPath,
  };
  const lockPath = claimLockPath(filePath);
  const lockAcquired = await acquireClaimLock(lockPath, args.owner);
  if (!lockAcquired) return { ok: false, reason: `tracker ${args.story.metadata.trackerPath} claim lock timed out` };
  try {
    const markdown = await readFile(filePath, 'utf8');
    const stories = parseTrackerStories(markdown, context);
    const current = stories.find((entry) => entry.id === args.story.id);
    if (!current) return { ok: false, reason: `story ${args.story.id} was not found` };
    if (current.owner !== null) {
      return { ok: false, reason: `owner is ${current.owner}`, story: current };
    }
    if (!current.eligible) {
      if (args.force !== true) {
        return { ok: false, reason: current.blockedReason ?? `story ${args.story.id} is not eligible`, story: current };
      }
    }

    const updated = updateTrackerStoryRow(markdown, context, args.story.id, {
      status: args.config.statuses.inProgress,
      owner: args.owner,
    });
    const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tempPath, updated);
    await rename(tempPath, filePath);

    const claimedStories = parseTrackerStories(await readFile(filePath, 'utf8'), context);
    const claimed = claimedStories.find((entry) => entry.id === args.story.id);
    if (!claimed) return { ok: false, reason: `story ${args.story.id} was not found after claim` };
    if (claimed.owner !== args.owner || claimed.status !== args.config.statuses.inProgress) {
      return { ok: false, reason: `story ${args.story.id} claim verification failed`, story: claimed };
    }
    return { ok: true, story: claimed };
  } finally {
    await releaseClaimLock(lockPath);
  }
}

export async function releaseTrackerClaim(args: {
  config: ResolvedWorkflowConfig;
  story: WorkflowStory;
  owner: string;
  previousStatus: string;
}): Promise<TrackerReleaseResult> {
  const filePath = trackerPath(args.config, args.story);
  const markdown = await readFile(filePath, 'utf8');
  const context = {
    completeStatuses: new Set(args.config.statuses.complete),
    eligibleStatuses: new Set(args.config.statuses.eligible),
    idPattern: new RegExp(args.config.tracker.idPattern),
    trackId: args.story.metadata.trackId,
    trackTitle: args.story.metadata.trackTitle,
    trackerPath: args.story.metadata.trackerPath,
  };
  const stories = parseTrackerStories(markdown, context);
  const current = stories.find((entry) => entry.id === args.story.id);
  if (!current) return { ok: false, reason: `story ${args.story.id} was not found` };
  if (current.owner !== args.owner) {
    return { ok: false, reason: `owner is ${current.owner ?? 'unowned'}`, story: current };
  }
  if (current.status !== args.config.statuses.inProgress) {
    return { ok: false, reason: `status is ${current.status}`, story: current };
  }
  if (!args.config.statuses.eligible.includes(args.previousStatus)) {
    return { ok: false, reason: `previous status ${args.previousStatus} is not eligible`, story: current };
  }

  const updated = updateTrackerStoryRow(markdown, context, args.story.id, {
    status: args.previousStatus,
    owner: '—',
  });
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tempPath, updated);
  await rename(tempPath, filePath);

  return { ok: true, fromStatus: current.status, toStatus: args.previousStatus };
}

function trackerPath(config: ResolvedWorkflowConfig, story: WorkflowStory): string {
  return path.resolve(config.workspace.rootAbs, story.metadata.trackerPath);
}

function claimLockPath(filePath: string): string {
  return `${filePath}.claim-${safeName(path.basename(filePath))}.lock`;
}

async function acquireClaimLock(lockPath: string, owner: string): Promise<boolean> {
  const deadline = Date.now() + CLAIM_LOCK_TIMEOUT_MS;
  for (;;) {
    try {
      await writeFile(lockPath, `${JSON.stringify(buildClaimLockMetadata(owner), null, 2)}\n`, { flag: 'wx' });
      return true;
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'EEXIST') throw error;
      if (await reclaimStaleClaimLock(lockPath)) continue;
      if (Date.now() >= deadline) return false;
      await delay(25);
    }
  }
}

async function releaseClaimLock(lockPath: string): Promise<void> {
  try {
    await unlink(lockPath);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return;
    throw error;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildClaimLockMetadata(owner: string): ClaimLockMetadata {
  return {
    owner,
    pid: process.pid,
    createdAt: new Date().toISOString(),
  };
}

async function reclaimStaleClaimLock(lockPath: string): Promise<boolean> {
  const inspected = await inspectClaimLock(lockPath);
  if (inspected === null) return true;
  if (!inspected.reclaimable) return false;
  try {
    await unlink(lockPath);
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return true;
    throw error;
  }
}

async function inspectClaimLock(lockPath: string): Promise<{ reclaimable: boolean } | null> {
  let content: string;
  let modifiedAtMs: number;
  try {
    const [fileContent, fileStats] = await Promise.all([readFile(lockPath, 'utf8'), stat(lockPath)]);
    content = fileContent;
    modifiedAtMs = fileStats.mtimeMs;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return null;
    throw error;
  }

  const metadata = parseClaimLockMetadata(content);
  if (metadata && isProcessDead(metadata.pid)) return { reclaimable: true };

  const createdAtMs = metadata ? Date.parse(metadata.createdAt) : Number.NaN;
  const ageStartedAtMs = Number.isFinite(createdAtMs) ? createdAtMs : modifiedAtMs;
  return { reclaimable: Date.now() - ageStartedAtMs > CLAIM_LOCK_STALE_AFTER_MS };
}

function parseClaimLockMetadata(content: string): ClaimLockMetadata | null {
  try {
    const value = JSON.parse(content);
    if (!isRecord(value)) return null;
    if (typeof value.owner !== 'string') return null;
    if (typeof value.pid !== 'number' || !Number.isInteger(value.pid) || value.pid <= 0) return null;
    if (typeof value.createdAt !== 'string') return null;
    return { owner: value.owner, pid: value.pid, createdAt: value.createdAt };
  } catch {
    return null;
  }
}

function isProcessDead(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ESRCH') return true;
    return false;
  }
}
