import { constants } from 'node:fs';
import { access, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

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
  return claimed
    ? { ok: true, story: claimed }
    : { ok: false, reason: `story ${args.story.id} was not found after claim` };
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
