import type { CredentialMaterialDestroyed, CredentialUseFinished, CredentialUseStarted } from './audit-types.js';

export type CredentialAuditLifecycleFailure = {
  readonly ok: false;
  readonly error: {
    readonly token: 'credential-destroy-unconfirmed';
    readonly operationId: string;
  };
};

export type CredentialAuditLifecycleSuccess = {
  readonly ok: true;
  readonly value: {
    readonly started: CredentialUseStarted;
    readonly finished: CredentialUseFinished;
    readonly destroyed: CredentialMaterialDestroyed;
  };
};

export type CredentialAuditLifecycleResult = CredentialAuditLifecycleSuccess | CredentialAuditLifecycleFailure;

export type ValidateCredentialAuditLifecycleInput = {
  readonly started: CredentialUseStarted;
  readonly finished?: CredentialUseFinished;
  readonly destroyed?: CredentialMaterialDestroyed;
};

const fail = (operationId: string): CredentialAuditLifecycleFailure => ({
  ok: false,
  error: {
    token: 'credential-destroy-unconfirmed',
    operationId,
  },
});

const hasMatchingCredentialRefIds = (
  left: CredentialUseStarted['credentialRefIds'],
  right: CredentialUseFinished['credentialRefIds'] | CredentialMaterialDestroyed['credentialRefIds'],
): boolean => left.length === right.length && left.every((credentialRefId, index) => credentialRefId === right[index]);

const hasMatchingAuditIdentity = (
  started: CredentialUseStarted,
  candidate: CredentialUseFinished | CredentialMaterialDestroyed,
): boolean =>
  started.runId === candidate.runId &&
  started.taskId === candidate.taskId &&
  started.operationId === candidate.operationId &&
  hasMatchingCredentialRefIds(started.credentialRefIds, candidate.credentialRefIds) &&
  started.party === candidate.party &&
  started.phase === candidate.phase &&
  started.policyDigest === candidate.policyDigest &&
  started.credentialRefDigest === candidate.credentialRefDigest &&
  started.scopeDigest === candidate.scopeDigest;

export const validateCredentialAuditLifecycle = (
  input: ValidateCredentialAuditLifecycleInput,
): CredentialAuditLifecycleResult => {
  if (input.finished === undefined || input.destroyed === undefined) {
    return fail(input.started.operationId);
  }

  if (
    !hasMatchingAuditIdentity(input.started, input.finished) ||
    !hasMatchingAuditIdentity(input.started, input.destroyed) ||
    input.finished.prevEventHash !== input.started.eventHash ||
    input.destroyed.prevEventHash !== input.finished.eventHash
  ) {
    return fail(input.started.operationId);
  }

  if (!input.finished.destroyed || !input.destroyed.tempFilesRemoved || !input.destroyed.memoryHandlesDropped) {
    return fail(input.started.operationId);
  }

  return {
    ok: true,
    value: {
      started: input.started,
      finished: input.finished,
      destroyed: input.destroyed,
    },
  };
};
