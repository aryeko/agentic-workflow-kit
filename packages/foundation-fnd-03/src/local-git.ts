import { access, mkdir, readFile, rm, stat, symlink, writeFile } from 'node:fs/promises';
import * as nodeFs from 'node:fs';
import { constants } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute, join, resolve } from 'node:path';
import * as git from 'isomorphic-git';
import type { WalkerEntry } from 'isomorphic-git';
import type {
  LocalGitEvidenceCommit,
  LocalGitEvidenceWorkingTree,
  RepositoryIdentity,
  RepositoryRegistration,
  WorkspaceFailure,
} from './types.js';

export type PreparedRepository = RepositoryIdentity & {
  readonly commonGitDir: string;
};

export type LocalCommitSnapshot = {
  readonly headSha: string;
  readonly mergeBaseSha: string;
  readonly commits: readonly LocalGitEvidenceCommit[];
};

export type GitTreeDiff = {
  readonly changedPaths: readonly string[];
};

export const resolveRepositoryIdentity = async (
  registration: RepositoryRegistration,
): Promise<RepositoryIdentity | WorkspaceFailure> => {
  const repoRoot = resolve(registration.repoRoot);
  const prepared = await resolvePreparedRepository(registration);
  if (isWorkspaceFailure(prepared)) {
    return prepared;
  }
  return {
    repoId: registration.repoId,
    repoRoot,
    gitDir: prepared.gitDir,
    defaultBaseRef: registration.defaultBaseRef,
  };
};

export const resolvePreparedRepository = async (
  registration: RepositoryRegistration,
): Promise<PreparedRepository | WorkspaceFailure> => {
  const repoRoot = resolve(registration.repoRoot);
  const gitDir = await resolveGitDir(repoRoot);
  if (gitDir === undefined) {
    return workspaceFailure('repository-unavailable', `repository is not readable: ${repoRoot}`);
  }
  const commonGitDir = await resolveCommonGitDir(gitDir);
  if (commonGitDir === undefined) {
    return workspaceFailure('repository-unavailable', `repository common git directory is not readable: ${repoRoot}`);
  }
  return {
    repoId: registration.repoId,
    repoRoot,
    gitDir,
    defaultBaseRef: registration.defaultBaseRef,
    commonGitDir,
  };
};

export const resolveLocalRef = async (repoRoot: string, ref: string): Promise<string | WorkspaceFailure> => {
  try {
    return await git.resolveRef({ fs: nodeFs, dir: repoRoot, ref });
  } catch {
    return workspaceFailure('base-ref-unresolved', `local ref could not be resolved: ${ref}`);
  }
};

export const localBranchSha = async (repoRoot: string, branchName: string): Promise<string | undefined> => {
  try {
    return await git.resolveRef({ fs: nodeFs, dir: repoRoot, ref: branchName });
  } catch {
    return undefined;
  }
};

export const createLinkedWorktree = async (input: {
  readonly sourceRepoRoot: string;
  readonly commonGitDir: string;
  readonly worktreePath: string;
  readonly worktreeGitDir: string;
  readonly branchName: string;
  readonly baseSha: string;
}): Promise<undefined | WorkspaceFailure> => {
  if (await pathExists(input.worktreePath)) {
    return workspaceFailure('worktree-path-conflict', `worktree path already exists: ${input.worktreePath}`);
  }
  if (await pathExists(input.worktreeGitDir)) {
    return workspaceFailure('worktree-path-conflict', `worktree registration already exists: ${input.worktreeGitDir}`);
  }

  try {
    const existingBranchSha = await localBranchSha(input.sourceRepoRoot, input.branchName);
    if (existingBranchSha === undefined) {
      await git.branch({
        fs: nodeFs,
        dir: input.sourceRepoRoot,
        gitdir: input.commonGitDir,
        ref: input.branchName,
        object: input.baseSha,
      });
    }
    await mkdir(input.worktreePath, { recursive: true });
    await mkdir(input.worktreeGitDir, { recursive: true });
    await writeFile(join(input.worktreePath, '.git'), `gitdir: ${input.worktreeGitDir}\n`);
    await writeFile(join(input.worktreeGitDir, 'gitdir'), `${join(input.worktreePath, '.git')}\n`);
    await writeFile(join(input.worktreeGitDir, 'commondir'), '../..\n');
    await writeFile(join(input.worktreeGitDir, 'HEAD'), `ref: refs/heads/${input.branchName}\n`);
    await symlink(join(input.commonGitDir, 'objects'), join(input.worktreeGitDir, 'objects'), 'dir');
    await symlink(join(input.commonGitDir, 'refs'), join(input.worktreeGitDir, 'refs'), 'dir');
    await git.checkout({
      fs: nodeFs,
      dir: input.worktreePath,
      gitdir: input.worktreeGitDir,
      ref: input.branchName,
      force: true,
      track: false,
    });
    return undefined;
  } catch (error) {
    await rm(input.worktreePath, { recursive: true, force: true });
    await rm(input.worktreeGitDir, { recursive: true, force: true });
    return workspaceFailure(
      'repository-unavailable',
      `linked worktree could not be created: ${error instanceof Error ? error.message : 'unknown error'}`,
    );
  }
};

export const inspectCommitRange = async (input: {
  readonly worktreePath: string;
  readonly branchName: string;
  readonly baseSha: string;
}): Promise<LocalCommitSnapshot> => {
  const headSha = await git.resolveRef({ fs: nodeFs, dir: input.worktreePath, ref: input.branchName });
  const mergeBases = await git.findMergeBase({
    fs: nodeFs,
    dir: input.worktreePath,
    oids: [input.baseSha, headSha],
  });
  const mergeBaseSha = typeof mergeBases[0] === 'string' ? mergeBases[0] : input.baseSha;
  const log = await git.log({ fs: nodeFs, dir: input.worktreePath, ref: headSha });
  const commits = log
    .filter((entry) => entry.oid !== mergeBaseSha)
    .map((entry) => ({
      sha: entry.oid,
      parentShas: entry.commit.parent,
      subject: firstSubjectLine(entry.commit.message),
      authoredAt: {
        epochSeconds: entry.commit.author.timestamp,
        timezoneOffset: entry.commit.author.timezoneOffset,
      },
    }));

  return { headSha, mergeBaseSha, commits };
};

export const inspectTreeDiff = async (input: {
  readonly worktreePath: string;
  readonly fromSha: string;
  readonly toSha: string;
}): Promise<GitTreeDiff> => {
  const changed = await git.walk({
    fs: nodeFs,
    dir: input.worktreePath,
    trees: [git.TREE({ ref: input.fromSha }), git.TREE({ ref: input.toSha })],
    map: async (filepath: string, entries: Array<WalkerEntry | null>) => {
      if (filepath === '.') {
        return undefined;
      }
      const [before, after] = entries;
      const beforeType = await entryType(before);
      const afterType = await entryType(after);
      if (beforeType === 'tree' || afterType === 'tree') {
        return undefined;
      }
      const beforeOid = await entryOid(before);
      const afterOid = await entryOid(after);
      return beforeOid === afterOid ? undefined : filepath;
    },
  });

  return { changedPaths: [...compactStrings(changed)].sort() };
};

export const inspectWorkingTree = async (worktreePath: string): Promise<LocalGitEvidenceWorkingTree> => {
  const matrix = await git.statusMatrix({ fs: nodeFs, dir: worktreePath, refresh: false });
  const stagedPaths = matrix.filter((row) => row[1] !== row[3] && row[3] !== 0).map((row) => row[0]);
  const unstagedPaths = matrix
    .filter((row) => row[2] !== row[3] && !(row[1] === 0 && row[3] === 0))
    .map((row) => row[0]);
  const untrackedPaths = matrix.filter((row) => row[1] === 0 && row[2] !== 0 && row[3] === 0).map((row) => row[0]);
  const sortedStaged = stagedPaths.sort();
  const sortedUnstaged = unstagedPaths.sort();
  const sortedUntracked = untrackedPaths.sort();
  return {
    clean: sortedStaged.length === 0 && sortedUnstaged.length === 0 && sortedUntracked.length === 0,
    stagedPaths: sortedStaged,
    unstagedPaths: sortedUnstaged,
    untrackedPaths: sortedUntracked,
  };
};

export const sha256File = async (path: string): Promise<string | undefined> => {
  try {
    return createHash('sha256')
      .update(await readFile(path))
      .digest('hex');
  } catch {
    return undefined;
  }
};

export const pathExists = async (path: string): Promise<boolean> => {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
};

export const removeWorktreePath = async (path: string): Promise<void> => {
  await rm(path, { recursive: true, force: true });
};

export const removeWorktreeRegistration = async (path: string): Promise<void> => {
  await rm(path, { recursive: true, force: true });
};

export const safeRelativePath = (root: string, relativePath: string): string | undefined => {
  if (relativePath.length === 0 || isAbsolute(relativePath)) {
    return undefined;
  }
  const absolute = resolve(root, relativePath);
  const normalizedRoot = resolve(root);
  if (absolute !== normalizedRoot && !absolute.startsWith(`${normalizedRoot}/`)) {
    return undefined;
  }
  return absolute;
};

const resolveGitDir = async (repoRoot: string): Promise<string | undefined> => {
  const dotGit = join(repoRoot, '.git');
  try {
    const dotGitStat = await stat(dotGit);
    if (dotGitStat.isDirectory()) {
      return dotGit;
    }
    const content = await readFile(dotGit, 'utf8');
    const match = /^gitdir:\s*(.+)\s*$/u.exec(content.trim());
    if (match?.[1] === undefined) {
      return undefined;
    }
    return resolve(repoRoot, match[1]);
  } catch {
    return undefined;
  }
};

const resolveCommonGitDir = async (gitDir: string): Promise<string | undefined> => {
  const commonDirFile = join(gitDir, 'commondir');
  let commonDir = gitDir;
  try {
    const commonDirContent = (await readFile(commonDirFile, 'utf8')).trim();
    commonDir = resolve(gitDir, commonDirContent);
  } catch {
    commonDir = gitDir;
  }
  return (await pathExists(join(commonDir, 'objects'))) ? commonDir : undefined;
};

const entryType = async (entry: WalkerEntry | null | undefined): Promise<string | undefined> => {
  if (entry === null || entry === undefined) {
    return undefined;
  }
  return entry.type();
};

const entryOid = async (entry: WalkerEntry | null | undefined): Promise<string | undefined> => {
  if (entry === null || entry === undefined) {
    return undefined;
  }
  return entry.oid();
};

const compactStrings = (values: readonly unknown[]): readonly string[] =>
  values.filter((value): value is string => typeof value === 'string' && value.length > 0);

const firstSubjectLine = (message: string): string => message.split('\n')[0]?.trim() ?? '';

const workspaceFailure = (reason: WorkspaceFailure['reason'], message: string): WorkspaceFailure => ({
  kind: 'workspace-failure',
  reason,
  message,
});

const isWorkspaceFailure = (value: unknown): value is WorkspaceFailure =>
  typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'workspace-failure';
