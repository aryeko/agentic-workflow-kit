import { access, readdir, readFile, stat } from 'node:fs/promises';
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

export interface IgnoredDuplicateLaunch {
  reason: string;
  storyId: string;
  launchId: string | null;
  expectedBranch: string;
  expectedWorktreePath: string | null;
  startedAt: string | null;
  ageMs: number | null;
  startupTimeoutMs: number;
}

export interface DuplicateLaunchCheck {
  conflict: DuplicateLaunchConflict | null;
  ignored: IgnoredDuplicateLaunch[];
}

export async function findDuplicateLaunch(args: {
  story: WorkflowStory;
  config: ResolvedWorkflowConfig;
  activeChildren: ActiveChildRun[];
  now: string;
}): Promise<DuplicateLaunchCheck> {
  const expectedBranch = renderExpectedBranch(args.story, args.config.git);
  const expectedWorktreePath = renderExpectedWorktreePath(args.config.workspace.rootAbs, args.config.git, args.story);

  const activeConflict = conflictFromActiveChildren({
    story: args.story,
    activeChildren: args.activeChildren,
    expectedBranch,
    expectedWorktreePath,
  });
  if (activeConflict) return { conflict: activeConflict, ignored: [] };

  return await conflictFromRunArtifacts({
    runsDir: args.config.artifacts.runsDirAbs,
    story: args.story,
    expectedBranch,
    expectedWorktreePath,
    now: args.now,
    startupTimeoutMs: args.config.orchestrator.childStartupTimeoutMs,
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
  now: string;
  startupTimeoutMs: number;
}): Promise<DuplicateLaunchCheck> {
  const ignored: IgnoredDuplicateLaunch[] = [];
  let runNames: string[];
  try {
    runNames = await readdir(args.runsDir);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return { conflict: null, ignored };
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
      if (launch.malformed) {
        return {
          conflict: {
            reason: `unreadable active launch reservation for ${args.story.id}`,
            storyId: launch.storyId,
            expectedBranch: args.expectedBranch,
            expectedWorktreePath: args.expectedWorktreePath,
          },
          ignored,
        };
      }
      if (launch?.status !== 'launched' && launch?.status !== 'requested') continue;
      const launchStoryId = typeof launch.storyId === 'string' ? launch.storyId : null;
      if (launchStoryId && (await settledResultExists(childrenDir, launchStoryId))) continue;
      const launchBranch = typeof launch.expectedBranch === 'string' ? launch.expectedBranch : null;
      const launchWorktree = typeof launch.expectedWorktreePath === 'string' ? launch.expectedWorktreePath : null;
      const matches =
        launchStoryId === args.story.id ||
        launchBranch === args.expectedBranch ||
        (args.expectedWorktreePath !== null && launchWorktree === args.expectedWorktreePath);
      if (!matches) continue;

      const staleStartup = await staleStartupLaunch({
        launch,
        now: args.now,
        startupTimeoutMs: args.startupTimeoutMs,
        expectedWorktreePath: launchWorktree,
      });
      if (staleStartup.stale) {
        ignored.push({
          reason: 'stale startup launch has no acknowledgement evidence',
          storyId: launchStoryId ?? args.story.id,
          launchId: typeof launch.launchId === 'string' ? launch.launchId : null,
          expectedBranch: launchBranch ?? args.expectedBranch,
          expectedWorktreePath: launchWorktree,
          startedAt: staleStartup.startedAt,
          ageMs: staleStartup.ageMs,
          startupTimeoutMs: args.startupTimeoutMs,
        });
        continue;
      }

      return {
        conflict: {
          reason: `duplicate active launch for ${args.story.id}`,
          storyId: launchStoryId ?? args.story.id,
          expectedBranch: launchBranch ?? args.expectedBranch,
          expectedWorktreePath: launchWorktree,
        },
        ignored,
      };
    }
  }

  return { conflict: null, ignored };
}

async function readLaunchRecord(
  filePath: string,
): Promise<(Record<string, unknown> & { malformed?: false }) | { malformed: true; storyId: string }> {
  try {
    const parsed = JSON.parse(await readFile(filePath, 'utf8')) as unknown;
    return isRecord(parsed) ? parsed : {};
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { malformed: true, storyId: path.basename(filePath).replace(/\.launch\.json$/, '') };
    }
    throw error;
  }
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

async function staleStartupLaunch(args: {
  launch: Record<string, unknown>;
  now: string;
  startupTimeoutMs: number;
  expectedWorktreePath: string | null;
}): Promise<{ stale: boolean; startedAt: string | null; ageMs: number | null }> {
  if (typeof args.launch.sessionId === 'string' && args.launch.sessionId.length > 0) {
    return { stale: false, startedAt: readString(args.launch.startedAt), ageMs: null };
  }
  if (typeof args.launch.lastHeartbeatAt === 'string' && args.launch.lastHeartbeatAt.length > 0) {
    return { stale: false, startedAt: readString(args.launch.startedAt), ageMs: null };
  }
  if (
    typeof args.launch.lastObservedChildProgressAt === 'string' &&
    args.launch.lastObservedChildProgressAt.length > 0
  ) {
    return { stale: false, startedAt: readString(args.launch.startedAt), ageMs: null };
  }

  const startedAt = readString(args.launch.startedAt);
  if (!startedAt) return { stale: false, startedAt: null, ageMs: null };
  const ageMs = Date.parse(args.now) - Date.parse(startedAt);
  if (!Number.isFinite(ageMs) || ageMs <= args.startupTimeoutMs) return { stale: false, startedAt, ageMs };

  if (
    args.expectedWorktreePath &&
    (await hasRecentWorktreeActivity(args.expectedWorktreePath, args.now, args.startupTimeoutMs))
  ) {
    return { stale: false, startedAt, ageMs };
  }

  return { stale: true, startedAt, ageMs };
}

async function hasRecentWorktreeActivity(
  worktreePath: string,
  now: string,
  startupTimeoutMs: number,
): Promise<boolean> {
  try {
    return await hasRecentPathActivity(worktreePath, now, startupTimeoutMs);
  } catch (error) {
    if (isNodeError(error) && error.code === 'ENOENT') return false;
    throw error;
  }
}

async function hasRecentPathActivity(filePath: string, now: string, startupTimeoutMs: number): Promise<boolean> {
  const info = await stat(filePath);
  const ageMs = Date.parse(now) - info.mtimeMs;
  if (Number.isFinite(ageMs) && ageMs <= startupTimeoutMs) return true;
  if (!info.isDirectory()) return false;

  const entries = await readdir(filePath, { withFileTypes: true });
  for (const entry of entries) {
    if (shouldSkipWorktreeActivityEntry(entry.name)) continue;
    if (await hasRecentPathActivity(path.join(filePath, entry.name), now, startupTimeoutMs)) return true;
  }
  return false;
}

function shouldSkipWorktreeActivityEntry(name: string): boolean {
  return name === '.git' || name === 'node_modules' || name === '.turbo' || name === '.next';
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
