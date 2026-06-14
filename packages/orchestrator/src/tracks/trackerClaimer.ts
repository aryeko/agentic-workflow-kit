import { constants } from 'node:fs';
import { access, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { isNodeError, safeName } from '../internal/guards.js';
import type { ResolvedWorkflowConfig, WorkflowStory } from '../types.js';
import { parseTrackerStories, updateTrackerStoryRow } from './markdownTracker.js';

export type TrackerClaimResult =
  | { ok: true; story: WorkflowStory }
  | { ok: false; reason: string; story?: WorkflowStory };

export type TrackerReleaseResult =
  | { ok: true; fromStatus: string; toStatus: string }
  | { ok: false; reason: string; story?: WorkflowStory };

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
  const deadline = Date.now() + 5000;
  for (;;) {
    try {
      await writeFile(lockPath, `${owner}\n`, { flag: 'wx' });
      return true;
    } catch (error) {
      if (!isNodeError(error) || error.code !== 'EEXIST') throw error;
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
