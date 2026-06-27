import { describe, expect, it } from 'vitest';

import { isVerificationFresh } from '../../../../src/core/completion/evidence/index.js';

import { createEvent, createLocalGitPayload, createVerifyCommand, toRef } from './shared.js';

describe('core-05-s2 verification freshness', () => {
  it('verification-freshness-matrix distinguishes fresh, failed, uncertain, and head-changed evidence', () => {
    const pre = createEvent('LocalGitEvidenceRecorded', 6, createLocalGitPayload());
    const command = createEvent('RunnerCommandCaptured', 7, createVerifyCommand());
    const post = createEvent('LocalGitEvidenceRecorded', 8, createLocalGitPayload());

    expect(
      isVerificationFresh({
        expectedHeadSha: 'head-01',
        expectedCommandDigest: 'sha256:verify-command',
        verification: {
          commandRef: toRef(command),
          command: command.payload,
          preLocalGitRef: toRef(pre),
          preLocalGit: pre.payload,
          postLocalGitRef: toRef(post),
          postLocalGit: post.payload,
        },
      }),
    ).toMatchObject({ fresh: true });

    expect(
      isVerificationFresh({
        expectedHeadSha: 'head-01',
        expectedCommandDigest: 'sha256:verify-command',
        verification: {
          commandRef: toRef(command),
          command: createVerifyCommand({ exitCode: 1 }),
          preLocalGitRef: toRef(pre),
          preLocalGit: pre.payload,
          postLocalGitRef: toRef(post),
          postLocalGit: post.payload,
        },
      }).state,
    ).toBe('verification-failed');

    expect(
      isVerificationFresh({
        expectedHeadSha: 'head-01',
        expectedCommandDigest: 'sha256:mismatch',
        verification: {
          commandRef: toRef(command),
          command: command.payload,
          preLocalGitRef: toRef(pre),
          preLocalGit: pre.payload,
          postLocalGitRef: toRef(post),
          postLocalGit: post.payload,
        },
      }).state,
    ).toBe('verification-uncertain');

    expect(
      isVerificationFresh({
        expectedHeadSha: 'head-01',
        expectedCommandDigest: 'sha256:verify-command',
        verification: {
          commandRef: toRef(command),
          command: command.payload,
          preLocalGitRef: toRef(pre),
          preLocalGit: pre.payload,
          postLocalGitRef: toRef(post),
          postLocalGit: createLocalGitPayload({ headSha: 'head-02' }),
        },
      }).state,
    ).toBe('verification-uncertain');

    expect(
      isVerificationFresh({
        expectedHeadSha: 'head-01',
        expectedCommandDigest: 'sha256:verify-command',
        verification: {
          commandRef: toRef(command),
          command: { ...command.payload, kind: 'diagnostic' },
          preLocalGitRef: toRef(pre),
          preLocalGit: pre.payload,
          postLocalGitRef: toRef(post),
          postLocalGit: post.payload,
        },
      }).state,
    ).toBe('verification-uncertain');

    expect(
      isVerificationFresh({
        expectedHeadSha: 'head-01',
        expectedCommandDigest: 'sha256:verify-command',
        verification: {
          commandRef: toRef(command),
          command: command.payload,
          preLocalGitRef: toRef(command),
          preLocalGit: pre.payload,
          postLocalGitRef: toRef(post),
          postLocalGit: post.payload,
        },
      }).state,
    ).toBe('verification-uncertain');

    expect(
      isVerificationFresh({
        expectedHeadSha: 'head-01',
        expectedCommandDigest: 'sha256:verify-command',
        verification: {
          commandRef: toRef(command),
          command: command.payload,
          preLocalGitRef: toRef(pre),
          preLocalGit: { ...pre.payload, clean: false },
          postLocalGitRef: toRef(post),
          postLocalGit: post.payload,
        },
      }).state,
    ).toBe('verification-uncertain');

    expect(
      isVerificationFresh({
        expectedHeadSha: 'head-01',
        expectedCommandDigest: 'sha256:verify-command',
        verification: {
          commandRef: toRef(command),
          command: command.payload,
          preLocalGitRef: toRef(pre),
          preLocalGit: pre.payload,
          postLocalGitRef: toRef(post),
          postLocalGit: post.payload,
          hostFailureRef: toRef(createEvent('HostOperationFailed', 9, {})),
          hostFailure: {
            reason: 'runner-command-capture-incomplete',
            message: 'missing digest',
            retryable: true,
            at: '2026-06-27T09:02:01.000Z',
          },
        },
      }).state,
    ).toBe('verification-uncertain');
  });
});
