import type { VerificationFreshnessResult, VerificationWindow } from './types.js';

type IsVerificationFreshInput = {
  readonly verification?: VerificationWindow;
  readonly expectedHeadSha: string;
  readonly expectedCommandDigest: string;
};

export const getVerificationEvidenceRefs = (verification: VerificationWindow | undefined) =>
  verification === undefined
    ? []
    : [
        verification.commandRef,
        verification.preLocalGitRef,
        verification.postLocalGitRef,
        ...(verification.hostFailureRef === undefined ? [] : [verification.hostFailureRef]),
      ];

export const isVerificationFresh = (input: IsVerificationFreshInput): VerificationFreshnessResult => {
  const evidenceRefs = getVerificationEvidenceRefs(input.verification);
  if (input.verification === undefined) {
    return { fresh: false, evidenceRefs };
  }

  const { verification } = input;
  if (verification.hostFailure !== undefined || verification.hostFailureRef !== undefined) {
    return { fresh: false, state: 'verification-uncertain', evidenceRefs };
  }

  if (verification.command.kind !== undefined && verification.command.kind !== 'verify') {
    return { fresh: false, state: 'verification-uncertain', evidenceRefs };
  }

  if (
    verification.preLocalGitRef.sequence >= verification.commandRef.sequence ||
    verification.commandRef.sequence >= verification.postLocalGitRef.sequence
  ) {
    return { fresh: false, state: 'verification-uncertain', evidenceRefs };
  }

  if (verification.command.exitCode !== 0) {
    return { fresh: false, state: 'verification-failed', evidenceRefs };
  }

  if (verification.command.commandDigest !== input.expectedCommandDigest) {
    return { fresh: false, state: 'verification-uncertain', evidenceRefs };
  }

  if (!verification.preLocalGit.clean || !verification.postLocalGit.clean) {
    return { fresh: false, state: 'verification-uncertain', evidenceRefs };
  }

  if (
    verification.preLocalGit.headSha !== input.expectedHeadSha ||
    verification.postLocalGit.headSha !== input.expectedHeadSha
  ) {
    return { fresh: false, state: 'verification-uncertain', evidenceRefs };
  }

  return { fresh: true, evidenceRefs };
};
