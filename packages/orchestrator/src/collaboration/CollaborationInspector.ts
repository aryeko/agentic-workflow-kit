import { execFile as nodeExecFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { GithubCheckEvidence, GithubReviewEvidence } from '../types.js';

const defaultExecFile = promisify(nodeExecFile);

export interface CollaborationBranchEvidence {
  name: string;
  exists: boolean;
}

export interface CollaborationPullRequestEvidence {
  number: number;
  url: string | null;
  state: 'open' | 'merged' | 'closed' | 'unknown';
  headSha: string | null;
  mergeCommitSha: string | null;
  mergedAt: string | null;
}

export interface CollaborationEvidence {
  available: boolean;
  source: 'github';
  verified: boolean;
  missingSignal?: string;
  detail?: string;
  pr?: CollaborationPullRequestEvidence;
  checks: GithubCheckEvidence[];
  review?: GithubReviewEvidence;
  branch?: CollaborationBranchEvidence;
}

export interface CollaborationInspector {
  inspectPullRequest(args: {
    cwdAbs: string;
    owner: string;
    repo: string;
    prNumber: number;
    branchName: string | null;
    reviewBot: string;
  }): Promise<CollaborationEvidence>;
  mergePullRequest?(args: {
    cwdAbs: string;
    owner: string;
    repo: string;
    prNumber: number;
    method: 'squash' | 'merge' | 'rebase';
    deleteBranch: boolean;
    branchName: string | null;
    reviewBot: string;
    expectedHeadSha: string;
  }): Promise<CollaborationEvidence>;
}

export type ExecFileAdapter = (command: string, args: string[], options: { cwd: string }) => Promise<string>;

export class GhCollaborationInspector implements CollaborationInspector {
  private readonly execFile: ExecFileAdapter;

  constructor(deps: { execFile?: ExecFileAdapter } = {}) {
    this.execFile =
      deps.execFile ??
      (async (command, args, options) => {
        const { stdout } = await defaultExecFile(command, args, { cwd: options.cwd });
        return stdout.trim();
      });
  }

  async inspectPullRequest(args: {
    cwdAbs: string;
    owner: string;
    repo: string;
    prNumber: number;
    branchName: string | null;
    reviewBot: string;
  }): Promise<CollaborationEvidence> {
    try {
      await this.execFile('gh', ['auth', 'status', '--hostname', 'github.com'], { cwd: args.cwdAbs });
    } catch (error) {
      return unavailable('gh-auth', error);
    }

    let view: unknown;
    try {
      const output = await this.execFile(
        'gh',
        [
          'pr',
          'view',
          String(args.prNumber),
          '--repo',
          `${args.owner}/${args.repo}`,
          '--json',
          [
            'number',
            'url',
            'state',
            'headRefOid',
            'mergeCommit',
            'mergedAt',
            'reviewDecision',
            'headRefName',
            'baseRefName',
            'statusCheckRollup',
            'reviews',
            'comments',
            'reactionGroups',
          ].join(','),
        ],
        { cwd: args.cwdAbs },
      );
      view = JSON.parse(output);
    } catch (error) {
      return unavailable('pr-state', error);
    }

    const pr = readPullRequest(view);
    if (!pr) return unavailable('pr-state', new Error('gh pr view returned no pull request'));
    const viewRecord = readRecord(view);
    const branchName = args.branchName ?? readString(viewRecord?.headRefName);
    const baseBranchName = readString(viewRecord?.baseRefName);
    const rollupChecks = readChecks(viewRecord?.statusCheckRollup);
    const requiredContexts = baseBranchName
      ? await this.requiredCheckContexts(args.cwdAbs, args.owner, args.repo, baseBranchName)
      : { available: true as const, contexts: [] };
    if (!requiredContexts.available) return unavailable('required-checks', requiredContexts.error);
    const checks = selectRequiredChecks(rollupChecks, requiredContexts.contexts);
    const review = readReview(view, args.reviewBot);
    const branch = branchName ? await this.branchEvidence(args.cwdAbs, args.owner, args.repo, branchName) : undefined;
    if (branchName && !branch)
      return unavailable('branch-state', new Error('remote branch state could not be verified'));

    return {
      available: true,
      source: 'github',
      verified: true,
      pr,
      checks,
      review,
      branch: branch ?? undefined,
    };
  }

  async mergePullRequest(args: {
    cwdAbs: string;
    owner: string;
    repo: string;
    prNumber: number;
    method: 'squash' | 'merge' | 'rebase';
    deleteBranch: boolean;
    branchName: string | null;
    reviewBot: string;
    expectedHeadSha: string;
  }): Promise<CollaborationEvidence> {
    try {
      await this.execFile(
        'gh',
        [
          'pr',
          'merge',
          String(args.prNumber),
          '--repo',
          `${args.owner}/${args.repo}`,
          `--${args.method}`,
          ...(args.deleteBranch ? ['--delete-branch'] : []),
          '--match-head-commit',
          args.expectedHeadSha,
        ],
        { cwd: args.cwdAbs },
      );
    } catch (error) {
      return unavailable('pr-merge', error);
    }
    return await this.inspectPullRequest(args);
  }

  private async branchEvidence(
    cwdAbs: string,
    owner: string,
    repo: string,
    branchName: string,
  ): Promise<CollaborationBranchEvidence | null> {
    try {
      await this.execFile('gh', ['api', `repos/${owner}/${repo}/branches/${encodeBranchName(branchName)}`], {
        cwd: cwdAbs,
      });
      return { name: branchName, exists: true };
    } catch (error) {
      return isNotFoundError(error) ? { name: branchName, exists: false } : null;
    }
  }

  private async requiredCheckContexts(
    cwdAbs: string,
    owner: string,
    repo: string,
    baseBranchName: string,
  ): Promise<{ available: true; contexts: string[] } | { available: false; error: unknown }> {
    try {
      const output = await this.execFile(
        'gh',
        [
          'api',
          `repos/${owner}/${repo}/branches/${encodeBranchName(baseBranchName)}/protection/required_status_checks`,
        ],
        { cwd: cwdAbs },
      );
      const parsed = JSON.parse(output);
      return { available: true, contexts: readStringArray(readRecord(parsed)?.contexts) };
    } catch (error) {
      if (isNotFoundError(error)) return { available: true, contexts: [] };
      return { available: false, error };
    }
  }
}

function unavailable(missingSignal: string, error: unknown): CollaborationEvidence {
  return {
    available: false,
    source: 'github',
    verified: false,
    missingSignal,
    detail: error instanceof Error ? error.message : String(error),
    checks: [],
  };
}

function readPullRequest(value: unknown): CollaborationPullRequestEvidence | null {
  const record = readRecord(value);
  if (!record) return null;
  const number = readNumber(record.number);
  if (number === null) return null;
  const mergeCommit = readRecord(record.mergeCommit);
  return {
    number,
    url: readString(record.url),
    state: readPrState(readString(record.state)),
    headSha: readString(record.headRefOid),
    mergeCommitSha: readString(mergeCommit?.oid),
    mergedAt: readString(record.mergedAt),
  };
}

function readChecks(value: unknown): GithubCheckEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.map(readCheck).filter((entry): entry is GithubCheckEvidence => entry !== null);
}

function isNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /\b(?:404|not found)\b/i.test(message);
}

function selectRequiredChecks(checks: GithubCheckEvidence[], requiredContexts: string[]): GithubCheckEvidence[] {
  if (requiredContexts.length === 0) return checks;
  return requiredContexts.map(
    (context) =>
      checks.find((check) => check.command === context) ?? {
        command: context,
        status: 'unknown',
        conclusion: 'unknown',
        detail: 'required check missing from PR status rollup',
      },
  );
}

function readCheck(value: unknown): GithubCheckEvidence | null {
  const record = readRecord(value);
  if (!record) return null;
  const name = readString(record.name) ?? readString(record.context);
  const conclusion = readString(record.conclusion) ?? readString(record.state) ?? readString(record.status);
  if (!name && !conclusion) return null;
  const normalized = normalizeConclusion(conclusion);
  return {
    command: name,
    status: normalized === 'success' || normalized === 'neutral' || normalized === 'skipped' ? 'passed' : 'failed',
    conclusion: normalized,
    detail: conclusion,
  };
}

function readReview(value: unknown, reviewBot: string): GithubReviewEvidence | undefined {
  const record = readRecord(value);
  if (!record) return undefined;
  const decision = readString(record.reviewDecision);
  if (hasBotReaction(record.reactionGroups, reviewBot, 'THUMBS_UP')) {
    return { reviewer: reviewBot, signal: 'approved', mechanism: 'reaction', detail: '+1 reaction' };
  }
  if (hasBotReaction(record.reactionGroups, reviewBot, 'EYES')) {
    return { reviewer: reviewBot, signal: 'pending', mechanism: 'reaction', detail: 'eyes reaction' };
  }
  if (reviewBot !== 'none') {
    return { reviewer: reviewBot, signal: 'unknown', mechanism: 'unknown', detail: decision };
  }
  if (decision === 'APPROVED') {
    return { reviewer: null, signal: 'approved', mechanism: 'native-review', detail: decision };
  }
  if (decision === 'CHANGES_REQUESTED') {
    return { reviewer: null, signal: 'findings', mechanism: 'native-review', detail: decision };
  }
  return { reviewer: null, signal: 'unknown', mechanism: 'unknown', detail: decision };
}

function hasBotReaction(value: unknown, bot: string, content: string): boolean {
  if (!Array.isArray(value) || bot === 'none') return false;
  return value.some((entry) => {
    const group = readRecord(entry);
    const users = readRecord(group?.users);
    const nodes = users?.nodes;
    return (
      readString(group?.content) === content &&
      Array.isArray(nodes) &&
      nodes.some((node) => readString(readRecord(node)?.login)?.toLowerCase() === bot.toLowerCase())
    );
  });
}

function readPrState(value: string | null): CollaborationPullRequestEvidence['state'] {
  if (value === 'OPEN') return 'open';
  if (value === 'MERGED') return 'merged';
  if (value === 'CLOSED') return 'closed';
  return 'unknown';
}

function normalizeConclusion(value: string | null): GithubCheckEvidence['conclusion'] {
  const normalized = value?.toLowerCase();
  if (normalized === 'success') return 'success';
  if (normalized === 'failure' || normalized === 'error') return 'failure';
  if (normalized === 'cancelled') return 'cancelled';
  if (normalized === 'skipped') return 'skipped';
  if (normalized === 'neutral') return 'neutral';
  if (normalized === 'timed_out') return 'timed_out';
  if (normalized === 'action_required') return 'action_required';
  return 'unknown';
}

function encodeBranchName(value: string): string {
  return value
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('%2F');
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}
