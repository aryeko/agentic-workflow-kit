import { execFile } from 'node:child_process';
import { lstat, mkdir, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { ResolvedGitConfig, WorkflowStory } from '../types.js';
import { renderExpectedBranch, renderExpectedWorktreePath } from './launchMetadata.js';

const execFileAsync = promisify(execFile);

export interface PreparedChildWorkspace {
  childCwdAbs: string;
  expectedBranch: string;
  expectedWorktreePath: string | null;
  prepared: boolean;
}

export interface PrepareChildWorkspaceArgs {
  story: WorkflowStory;
  workspaceRootAbs: string;
  fallbackCwdAbs: string;
  git: ResolvedGitConfig;
}

export async function prepareChildWorkspace(args: PrepareChildWorkspaceArgs): Promise<PreparedChildWorkspace> {
  const expectedBranch = renderExpectedBranch(args.story, args.git);
  const expectedWorktreePath = renderExpectedWorktreePath(args.workspaceRootAbs, args.git, args.story);
  if (args.git.strategy !== 'worktree' || expectedWorktreePath === null) {
    return { childCwdAbs: args.fallbackCwdAbs, expectedBranch, expectedWorktreePath: null, prepared: false };
  }

  await assertRepoLocalWorktreePath(args.workspaceRootAbs, args.git.worktreeDir, expectedWorktreePath);

  if (await isGitWorktree(expectedWorktreePath)) {
    if (!(await belongsToSameRepository(args.workspaceRootAbs, expectedWorktreePath))) {
      throw new Error('expected worktree path does not belong to the workspace repository');
    }
    const branch = await gitOutput(expectedWorktreePath, ['rev-parse', '--abbrev-ref', 'HEAD']);
    if (branch !== expectedBranch) {
      throw new Error(`expected worktree path is on branch ${branch}, expected ${expectedBranch}`);
    }
    return { childCwdAbs: expectedWorktreePath, expectedBranch, expectedWorktreePath, prepared: true };
  }

  if (await pathExists(expectedWorktreePath)) {
    throw new Error('expected worktree path exists but is not a git worktree');
  }

  await mkdir(path.dirname(expectedWorktreePath), { recursive: true });
  await assertRepoLocalWorktreePath(args.workspaceRootAbs, args.git.worktreeDir, expectedWorktreePath);
  if (await branchExists(args.workspaceRootAbs, expectedBranch)) {
    throw new Error(
      `expected branch ${expectedBranch} already exists without a verified worktree; manual recovery required`,
    );
  }
  await gitOutput(args.workspaceRootAbs, [
    'worktree',
    'add',
    expectedWorktreePath,
    '-b',
    expectedBranch,
    args.git.baseBranch,
  ]);

  return { childCwdAbs: expectedWorktreePath, expectedBranch, expectedWorktreePath, prepared: true };
}

async function assertRepoLocalWorktreePath(
  workspaceRootAbs: string,
  worktreeDir: string,
  expectedWorktreePath: string,
): Promise<void> {
  const normalizedRoot = path.resolve(workspaceRootAbs);
  const normalizedWorktreeRoot = path.resolve(workspaceRootAbs, worktreeDir);
  const normalizedExpected = path.resolve(expectedWorktreePath);
  if (!isInside(normalizedExpected, normalizedRoot) || !isInside(normalizedExpected, normalizedWorktreeRoot)) {
    throw new Error(`expected worktree path escapes configured workspace worktree directory: ${expectedWorktreePath}`);
  }
  if (await isSymlink(normalizedWorktreeRoot)) {
    throw new Error(`configured worktree directory must not be a symlink: ${normalizedWorktreeRoot}`);
  }
  if (await isSymlink(normalizedExpected)) {
    throw new Error(`expected worktree path must not be a symlink: ${normalizedExpected}`);
  }
  await assertNoSymlinkAncestors(normalizedRoot, normalizedWorktreeRoot, 'configured worktree directory');
  await assertNoSymlinkAncestors(normalizedWorktreeRoot, normalizedExpected, 'expected worktree path');
  const realRoot = await realpath(normalizedRoot);
  const realWorktreeRoot = await realpathIfExists(normalizedWorktreeRoot);
  if (realWorktreeRoot !== null && !isInside(realWorktreeRoot, realRoot)) {
    throw new Error(`configured worktree directory escapes workspace root: ${normalizedWorktreeRoot}`);
  }
  const realExpected = await realpathIfExists(normalizedExpected);
  if (realExpected !== null && realWorktreeRoot !== null && !isInside(realExpected, realWorktreeRoot)) {
    throw new Error(`expected worktree path escapes configured workspace worktree directory: ${expectedWorktreePath}`);
  }
}

function isInside(child: string, parent: string): boolean {
  const relative = path.relative(parent, child);
  return relative.length === 0 || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

async function isGitWorktree(cwd: string): Promise<boolean> {
  if ((await maybeGitOutput(cwd, ['rev-parse', '--is-inside-work-tree'])) !== 'true') return false;
  const topLevel = await maybeGitOutput(cwd, ['rev-parse', '--show-toplevel']);
  return topLevel !== null && (await realpath(topLevel)) === (await realpath(cwd));
}

async function branchExists(cwd: string, branch: string): Promise<boolean> {
  return (await maybeGitOutput(cwd, ['rev-parse', '--verify', branch])) !== null;
}

async function belongsToSameRepository(workspaceRootAbs: string, worktreePath: string): Promise<boolean> {
  const rootCommonDir = await gitCommonDir(workspaceRootAbs);
  const worktreeCommonDir = await gitCommonDir(worktreePath);
  return rootCommonDir !== null && worktreeCommonDir !== null && rootCommonDir === worktreeCommonDir;
}

async function gitCommonDir(cwd: string): Promise<string | null> {
  const commonDir = await maybeGitOutput(cwd, ['rev-parse', '--git-common-dir']);
  if (commonDir === null) return null;
  return await realpath(path.resolve(cwd, commonDir));
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function isSymlink(target: string): Promise<boolean> {
  try {
    return (await lstat(target)).isSymbolicLink();
  } catch {
    return false;
  }
}

async function assertNoSymlinkAncestors(parent: string, child: string, label: string): Promise<void> {
  const relative = path.relative(parent, child);
  if (relative.length === 0) return;
  let current = parent;
  for (const segment of relative.split(path.sep)) {
    if (segment.length === 0) continue;
    current = path.join(current, segment);
    if (await isSymlink(current)) {
      throw new Error(`${label} must not contain symlink ancestors: ${current}`);
    }
  }
}

async function realpathIfExists(target: string): Promise<string | null> {
  try {
    return await realpath(target);
  } catch {
    return null;
  }
}

async function maybeGitOutput(cwd: string, args: string[]): Promise<string | null> {
  try {
    return await gitOutput(cwd, args);
  } catch {
    return null;
  }
}

async function gitOutput(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout.trim();
}
