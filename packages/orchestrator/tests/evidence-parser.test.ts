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
    expect(evidence.mergeCommit).toBe('abc1234');
    expect(evidence.verification).toEqual([{ command: 'pnpm check', status: 'passed', phase: 'final', detail: null }]);
  });
});
