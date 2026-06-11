import { describe, expect, it } from 'vitest';
import { evaluateRecoveryGuard } from '../src/runner/RecoveryGuard';

describe('evaluateRecoveryGuard', () => {
  it('requires manual recovery when child liveness evidence is ambiguous', () => {
    const result = evaluateRecoveryGuard({
      storyId: 'PLD10',
      now: '2026-06-11T03:00:00.000Z',
      staleAfterMs: 1_800_000,
      session: {
        sessionId: '019eb471-c9ef-7600-9ef9-f6b726855553',
        lastHeartbeatAt: '2026-06-11T02:45:00.000Z',
      },
      git: {
        expectedBranch: 'personalized-learning-dashboard/pld10-recommendation-controls-ui',
        remoteBranchExists: true,
        latestCommitSha: 'abc123',
        worktreeClean: true,
      },
      pr: { state: 'open', number: 91, mergedAt: null },
      trackerOnBase: { status: 'implementing', complete: false },
    });

    expect(result.decision).toBe('manual_recovery_required');
    expect(result.evidence).toContain('session 019eb471-c9ef-7600-9ef9-f6b726855553 has recent heartbeat');
    expect(result.evidence).toContain('PR #91 is open');
  });

  it('allows takeover only when liveness is stale and the worktree is clean', () => {
    const result = evaluateRecoveryGuard({
      storyId: 'PLD10',
      now: '2026-06-11T03:30:00.000Z',
      staleAfterMs: 1_800_000,
      session: {
        sessionId: null,
        lastHeartbeatAt: '2026-06-11T02:00:00.000Z',
      },
      git: {
        expectedBranch: 'personalized-learning-dashboard/pld10-recommendation-controls-ui',
        remoteBranchExists: false,
        latestCommitSha: null,
        worktreeClean: true,
      },
      pr: { state: 'none', number: null, mergedAt: null },
      trackerOnBase: { status: 'implementing', complete: false },
    });

    expect(result.decision).toBe('safe_to_take_over');
    expect(result.evidence).toContain('no linked child session');
    expect(result.evidence).toContain('worktree is clean');
  });

  it('requires manual recovery when the child worktree is dirty', () => {
    const result = evaluateRecoveryGuard({
      storyId: 'PLD11',
      now: '2026-06-11T03:30:00.000Z',
      staleAfterMs: 1_800_000,
      session: { sessionId: null, lastHeartbeatAt: null },
      git: {
        expectedBranch: 'personalized-learning-dashboard/pld11-relevance-reporting-closeout',
        remoteBranchExists: false,
        latestCommitSha: null,
        worktreeClean: false,
      },
      pr: { state: 'none', number: null, mergedAt: null },
      trackerOnBase: { status: 'implementing', complete: false },
    });

    expect(result.decision).toBe('manual_recovery_required');
    expect(result.evidence).toContain('worktree is dirty');
  });
});
