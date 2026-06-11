export type RecoveryDecision = 'manual_recovery_required' | 'safe_to_take_over';

export interface RecoveryGuardInput {
  storyId: string;
  now: string;
  staleAfterMs: number;
  session: {
    sessionId: string | null;
    lastHeartbeatAt: string | null;
  };
  git: {
    expectedBranch: string;
    remoteBranchExists: boolean;
    latestCommitSha: string | null;
    worktreeClean: boolean;
  };
  pr: {
    state: 'none' | 'open' | 'merged' | 'closed';
    number: number | null;
    mergedAt: string | null;
  };
  trackerOnBase: {
    status: string | null;
    complete: boolean;
  };
}

export interface RecoveryGuardResult {
  storyId: string;
  decision: RecoveryDecision;
  evidence: string[];
}

export function evaluateRecoveryGuard(input: RecoveryGuardInput): RecoveryGuardResult {
  const evidence: string[] = [];
  const blockers: string[] = [];

  if (input.session.sessionId) {
    if (input.session.lastHeartbeatAt && !isStale(input.session.lastHeartbeatAt, input.now, input.staleAfterMs)) {
      blockers.push(`session ${input.session.sessionId} has recent heartbeat`);
    } else {
      evidence.push(`session ${input.session.sessionId} has no recent heartbeat`);
    }
  } else {
    evidence.push('no linked child session');
  }

  if (input.git.remoteBranchExists) {
    blockers.push(`remote branch ${input.git.expectedBranch} still exists`);
  } else {
    evidence.push(`remote branch ${input.git.expectedBranch} is absent`);
  }

  if (input.git.latestCommitSha) {
    blockers.push(`latest child commit ${input.git.latestCommitSha} exists`);
  } else {
    evidence.push('no child commit evidence');
  }

  if (input.git.worktreeClean) {
    evidence.push('worktree is clean');
  } else {
    blockers.push('worktree is dirty');
  }

  if (input.pr.state === 'open' && input.pr.number !== null) {
    blockers.push(`PR #${input.pr.number} is open`);
  } else if (input.pr.state === 'merged' && input.pr.number !== null) {
    blockers.push(`PR #${input.pr.number} is merged`);
  } else {
    evidence.push('no open or merged PR is active');
  }

  if (input.trackerOnBase.complete) {
    blockers.push(`tracker on base is already complete with status ${input.trackerOnBase.status ?? 'unknown'}`);
  } else {
    evidence.push(`tracker on base is not complete (${input.trackerOnBase.status ?? 'unknown'})`);
  }

  return {
    storyId: input.storyId,
    decision: blockers.length > 0 ? 'manual_recovery_required' : 'safe_to_take_over',
    evidence: [...evidence, ...blockers],
  };
}

function isStale(value: string, now: string, staleAfterMs: number): boolean {
  const thenMs = Date.parse(value);
  const nowMs = Date.parse(now);
  if (!Number.isFinite(thenMs) || !Number.isFinite(nowMs)) return false;
  return nowMs - thenMs > staleAfterMs;
}
