import { execFile } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
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

  assertRepoLocalWorktreePath(args.workspaceRootAbs, args.git.worktreeDir, expectedWorktreePath);

  if (await isGitWorktree(expectedWorktreePath)) {
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
  if (await branchExists(args.workspaceRootAbs, expectedBranch)) {
    await gitOutput(args.workspaceRootAbs, ['worktree', 'add', expectedWorktreePath, expectedBranch]);
  } else {
    await gitOutput(args.workspaceRootAbs, ['worktree', 'add', expectedWorktreePath, '-b', expectedBranch, args.git.baseBranch]);
  }

  return { childCwdAbs: expectedWorktreePath, expectedBranch, expectedWorktreePath, prepared: true };
}

function assertRepoLocalWorktreePath(workspaceRootAbs: string, worktreeDir: string, expectedWorktreePath: string): void {
  const normalizedRoot = path.resolve(workspaceRootAbs);
  const normalizedWorktreeRoot = path.resolve(workspaceRootAbs, worktreeDir);
  const normalizedExpected = path.resolve(expectedWorktreePath);
  if (!isInside(normalizedExpected, normalizedRoot) || !isInside(normalizedExpected, normalizedWorktreeRoot)) {
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
  return topLevel !== null && path.resolve(topLevel) === path.resolve(cwd);
}

async function branchExists(cwd: string, branch: string): Promise<boolean> {
  return (await maybeGitOutput(cwd, ['rev-parse', '--verify', branch])) !== null;
}

async function pathExists(target: string): Promise<boolean> {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
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
