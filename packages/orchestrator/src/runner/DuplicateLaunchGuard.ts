import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { isNodeError, isRecord, safeName } from '../internal/guards.js';
import type { ActiveChildRun, ResolvedWorkflowConfig, WorkflowStory } from '../types.js';
import { renderExpectedBranch, renderExpectedWorktreePath } from './launchMetadata.js';

export interface DuplicateLaunchConflict {
  reason: string;
  storyId: string;
  expectedBranch: string;
  expectedWorktreePath: string | null;
}

export async function findDuplicateLaunch(args: {
  story: WorkflowStory;
  config: ResolvedWorkflowConfig;
  activeChildren: ActiveChildRun[];
}): Promise<DuplicateLaunchConflict | null> {
  const expectedBranch = renderExpectedBranch(args.story, args.config.git);
  const expectedWorktreePath = renderExpectedWorktreePath(args.config.workspace.rootAbs, args.config.git, args.story);

  const activeConflict = conflictFromActiveChildren({
    story: args.story,
    activeChildren: args.activeChildren,
    expectedBranch,
    expectedWorktreePath,
  });
  if (activeConflict) return activeConflict;

  return await conflictFromRunArtifacts({
    runsDir: args.config.artifacts.runsDirAbs,
    story: args.story,
    expectedBranch,
    expectedWorktreePath,
  });
}

function conflictFromActiveChildren(args: {
  story: WorkflowStory;
  activeChildren: ActiveChildRun[];
  expectedBranch: string;
  expectedWorktreePath: string | null;
}): DuplicateLaunchConflict | null {
  for (const active of args.activeChildren) {
    if (
      active.storyId === args.story.id ||
      active.expectedBranch === args.expectedBranch ||
      (args.expectedWorktreePath !== null && active.expectedWorktreePath === args.expectedWorktreePath)
    ) {
      return {
        reason: `duplicate active launch for ${args.story.id}`,
        storyId: active.storyId,
        expectedBranch: active.expectedBranch,
        expectedWorktreePath: active.expectedWorktreePath,
      };
    }
  }
  return null;
}

async function conflictFromRunArtifacts(args: {
  runsDir: string;
  story: WorkflowStory;
  expectedBranch: string;
  expectedWorktreePath: string | null;
}): Promise<DuplicateLaunchConflict | null> {
  let runNames: string[];
  try {
    runNames = await readdir(args.runsDir);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return null;
    throw error;
  }

  for (const runName of runNames.sort()) {
    const childrenDir = path.join(args.runsDir, runName, 'children');
    let childNames: string[];
    try {
      childNames = await readdir(childrenDir);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') continue;
      throw error;
    }

    for (const childName of childNames.filter((name) => name.endsWith('.launch.json')).sort()) {
      const launch = await readLaunchRecord(path.join(childrenDir, childName));
      if (launch?.status !== 'launched') continue;
      const launchStoryId = typeof launch.storyId === 'string' ? launch.storyId : null;
      if (launchStoryId && (await settledResultExists(childrenDir, launchStoryId))) continue;
      const launchBranch = typeof launch.expectedBranch === 'string' ? launch.expectedBranch : null;
      const launchWorktree = typeof launch.expectedWorktreePath === 'string' ? launch.expectedWorktreePath : null;
      if (
        launchStoryId === args.story.id ||
        launchBranch === args.expectedBranch ||
        (args.expectedWorktreePath !== null && launchWorktree === args.expectedWorktreePath)
      ) {
        return {
          reason: `duplicate active launch for ${args.story.id}`,
          storyId: launchStoryId ?? args.story.id,
          expectedBranch: launchBranch ?? args.expectedBranch,
          expectedWorktreePath: launchWorktree,
        };
      }
    }
  }

  return null;
}

async function readLaunchRecord(filePath: string): Promise<Record<string, unknown> | null> {
  const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
  return isRecord(parsed) ? parsed : null;
}

async function settledResultExists(childrenDir: string, storyId: string): Promise<boolean> {
  try {
    await access(path.join(childrenDir, `${safeName(storyId)}.json`));
    return true;
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return false;
    throw error;
  }
}
