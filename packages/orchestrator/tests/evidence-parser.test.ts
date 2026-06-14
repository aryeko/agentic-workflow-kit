import { describe, expect, it } from 'vitest';

import { childResultEvidence } from '../src/drivers/codex-mcp/evidenceParser.js';

describe('childResultEvidence', () => {
  it('captures a PR URL without treating unrelated merged wording as same-PR merge evidence', () => {
    const evidence = childResultEvidence(
      {},
      [
        'Opened https://github.com/aryeko/pathway/pull/108 for DLD05.',
        'This builds on the already-merged DLD04 workflow.',
      ].join('\n'),
    );

    expect(evidence.prNumber).toBe(108);
    expect(evidence.prUrl).toBe('https://github.com/aryeko/pathway/pull/108');
    expect(evidence.merged).toBeUndefined();
    expect(evidence.mergeCommit).toBeUndefined();
  });

  it('does not attach an unrelated merge commit to the captured PR', () => {
    const evidence = childResultEvidence(
      { childResult: { storyId: 'DLD05' } },
      [
        'Opened https://github.com/aryeko/pathway/pull/108 for DLD05.',
        'DLD04 was merged with squash commit abc1234.',
      ].join('\n'),
    );

    expect(evidence.prNumber).toBe(108);
    expect(evidence.merged).toBeUndefined();
    expect(evidence.mergeCommit).toBeUndefined();
  });

  it('does not attach an unrelated merge commit when identity is structured only', () => {
    const evidence = childResultEvidence(
      { childResult: { storyId: 'DLD05', prNumber: 108 } },
      'DLD04 was merged with squash commit abc1234.',
    );

    expect(evidence.prNumber).toBe(108);
    expect(evidence.storyId).toBe('DLD05');
    expect(evidence.merged).toBeUndefined();
    expect(evidence.mergeCommit).toBeUndefined();
  });

  it('keeps merge commits that name the current story', () => {
    const evidence = childResultEvidence(
      { childResult: { storyId: 'DLD05' } },
      [
        'Opened https://github.com/aryeko/pathway/pull/108 for DLD05.',
        'DLD05 PR #108 was merged with squash commit abc1234.',
      ].join('\n'),
    );

    expect(evidence.prNumber).toBe(108);
    expect(evidence.merged).toBe(true);
    expect(evidence.mergeCommit).toBe('abc1234');
  });

  it('keeps current-story merge commits with PR mentions when structured PR number is absent', () => {
    const evidence = childResultEvidence(
      { childResult: { storyId: 'DLD05' } },
      'DLD05 PR #108 was merged with squash commit abc1234.',
    );

    expect(evidence.merged).toBe(true);
    expect(evidence.mergeCommit).toBe('abc1234');
  });

  it('does not attach PR-only merge commits when structured PR number is absent', () => {
    const evidence = childResultEvidence(
      { childResult: { storyId: 'DLD05' } },
      'PR #108 was merged with squash commit abc1234.',
    );

    expect(evidence.merged).toBeUndefined();
    expect(evidence.mergeCommit).toBeUndefined();
  });

  it('does not treat negated same-PR merge wording as merge evidence', () => {
    const evidence = childResultEvidence(
      {},
      [
        'Opened https://github.com/aryeko/pathway/pull/108 for DLD05.',
        'PR #108 has not been merged yet because checks are not green.',
      ].join('\n'),
    );

    expect(evidence.prNumber).toBe(108);
    expect(evidence.merged).toBeUndefined();
  });

  it('normalizes tracker row done phrasing from compatibility text', () => {
    const evidence = childResultEvidence(
      {},
      'Tracker row is done and linked to PR #108: https://github.com/aryeko/pathway/pull/108',
    );

    expect(evidence.finalStatus).toBe('done');
    expect(evidence.trackerStatusEvidence).toContain('Tracker row is done');
  });

  it('does not record failed post-deploy smoke detail as passed verification', () => {
    const evidence = childResultEvidence(
      {},
      [
        'Verification:',
        '- `Post-deploy smoke` passed: Blocker: PR checks are not green. Post-deploy smoke fails on the protected preview.',
      ].join('\n'),
    );

    expect(evidence.verification).toEqual([
      {
        command: 'Post-deploy smoke',
        status: 'failed',
        phase: 'verification',
        detail:
          '- `Post-deploy smoke` passed: Blocker: PR checks are not green. Post-deploy smoke fails on the protected preview.',
      },
    ]);
    expect(evidence.blockers).toContain(
      '- `Post-deploy smoke` passed: Blocker: PR checks are not green. Post-deploy smoke fails on the protected preview.',
    );
  });

  it('treats negated failure words in passed verification as success', () => {
    const evidence = childResultEvidence(
      {},
      ['Verification:', '- `pnpm check` passed with no failed checks and no errors.'].join('\n'),
    );

    expect(evidence.verification).toEqual([
      {
        command: 'pnpm check',
        status: 'passed',
        phase: 'verification',
        detail: '- `pnpm check` passed with no failed checks and no errors.',
      },
    ]);
  });

  it('lets structured child evidence override compatibility text', () => {
    const evidence = childResultEvidence(
      {
        childResult: {
          finalStatus: 'verified',
          merged: false,
          verification: [{ command: 'pnpm check', status: 'passed', phase: 'final' }],
        },
      },
      [
        'Tracker row is done and linked to PR #108: https://github.com/aryeko/pathway/pull/108',
        'Merged with squash commit abc1234.',
      ].join('\n'),
    );

    expect(evidence.finalStatus).toBe('verified');
    expect(evidence.merged).toBe(false);
    expect(evidence.mergeCommit).toBeUndefined();
    expect(evidence.verification).toEqual([{ command: 'pnpm check', status: 'passed', phase: 'final', detail: null }]);
  });

  it('downgrades structured passed verification when detail contains blocker language', () => {
    const evidence = childResultEvidence(
      {
        childResult: {
          verification: [
            {
              command: 'Post-deploy smoke',
              status: 'passed',
              phase: 'verification',
              detail: 'Blocker: PR checks are not green. Post-deploy smoke fails on the protected preview.',
            },
          ],
        },
      },
      '',
    );

    expect(evidence.verification).toEqual([
      {
        command: 'Post-deploy smoke',
        status: 'failed',
        phase: 'verification',
        detail: 'Blocker: PR checks are not green. Post-deploy smoke fails on the protected preview.',
      },
    ]);
  });

  it('keeps structured passed verification when failure words are negated', () => {
    const evidence = childResultEvidence(
      {
        childResult: {
          verification: [
            {
              command: 'pnpm check',
              status: 'passed',
              phase: 'verification',
              detail: 'pnpm check passed with no failed checks and no errors.',
            },
          ],
        },
      },
      '',
    );

    expect(evidence.verification).toEqual([
      {
        command: 'pnpm check',
        status: 'passed',
        phase: 'verification',
        detail: 'pnpm check passed with no failed checks and no errors.',
      },
    ]);
  });

  it('preserves structured GitHub evidence and fills flat compatibility fields', () => {
    const evidence = childResultEvidence(
      {
        childResult: {
          github: {
            prNumber: 108,
            prUrl: 'https://github.com/aryeko/pathway/pull/108',
            checks: [{ command: 'gh pr checks 108 --watch', status: 'passed', conclusion: 'success' }],
            review: { reviewer: 'codex', mechanism: 'reaction', signal: 'approved', findings: 0, triaged: true },
            merge: { merged: true, method: 'squash', commit: 'abc1234', branchDeleted: true },
          },
        },
      },
      '',
    );

    expect(evidence.prNumber).toBe(108);
    expect(evidence.prUrl).toBe('https://github.com/aryeko/pathway/pull/108');
    expect(evidence.merged).toBe(true);
    expect(evidence.mergeCommit).toBe('abc1234');
    expect(evidence.branchDeleted).toBe(true);
    expect(evidence.github?.review?.signal).toBe('approved');
    expect(evidence.github?.checks?.[0]).toMatchObject({ status: 'passed', conclusion: 'success' });
  });

  it('parses Codex pending review, check, merge, and cleanup text conservatively', () => {
    const evidence = childResultEvidence(
      {},
      [
        'Opened https://github.com/aryeko/pathway/pull/108 for DLD05.',
        '`gh pr checks 108 --watch --fail-fast` passed with all checks green.',
        'Codex eyes reaction observed on the PR body, review is pending.',
        'DLD05 PR #108 was merged with squash commit abc1234.',
        'Remote story branch was deleted.',
      ].join('\n'),
    );

    expect(evidence.github?.checks?.[0]).toMatchObject({
      command: 'gh pr checks 108 --watch --fail-fast',
      status: 'passed',
    });
    expect(evidence.github?.review).toMatchObject({ reviewer: 'codex', signal: 'pending', mechanism: 'reaction' });
    expect(evidence.github?.merge).toMatchObject({
      merged: true,
      method: 'squash',
      commit: 'abc1234',
      branchDeleted: true,
    });
  });

  it('parses Codex findings as comments rather than approval', () => {
    const evidence = childResultEvidence({}, 'Codex review comments: 2 findings; replied and resolved.');

    expect(evidence.github?.review).toMatchObject({
      reviewer: 'codex',
      signal: 'findings',
      mechanism: 'review-comment',
      triaged: true,
      findings: 2,
    });
  });
});
