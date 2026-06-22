import { stableCanonicalStringify } from '../../configuration-policy/index.js';
import type {
  AuditBase,
  AuditHashDependencies,
  AuditSeed,
  CredentialAuditEvent,
  CredentialMaterialDestroyed,
  CredentialMaterialDestroyedInput,
  CredentialUseDenied,
  CredentialUseDeniedInput,
  CredentialUseFinished,
  CredentialUseFinishedInput,
  CredentialUsePlanned,
  CredentialUsePlannedInput,
  CredentialUseStarted,
  CredentialUseStartedInput,
  DestroyCredentialMaterialContext,
  EgressPolicyIssued,
  EgressPolicyIssuedInput,
  RedactionApplied,
  RedactionAppliedInput,
} from './audit-types.js';

type HashableAuditEvent = Omit<CredentialAuditEvent, 'eventHash'>;

const cloneAuditSeed = (audit: AuditSeed): AuditSeed => ({
  runId: audit.runId,
  taskId: audit.taskId,
  operationId: audit.operationId,
  credentialRefIds: [...audit.credentialRefIds],
  party: audit.party,
  phase: audit.phase,
  policyDigest: audit.policyDigest,
  credentialRefDigest: audit.credentialRefDigest,
  scopeDigest: audit.scopeDigest,
  ...(audit.grantEventId === undefined ? {} : { grantEventId: audit.grantEventId }),
  attestationEventIds: [...audit.attestationEventIds],
  evidenceRefs: [...audit.evidenceRefs],
  prevEventHash: audit.prevEventHash,
  at: audit.at,
});

export const buildCredentialAuditEventHash = (event: HashableAuditEvent, dependencies: AuditHashDependencies): string =>
  dependencies.hashText(stableCanonicalStringify(event));

const finalizeAuditEvent = <TEvent extends HashableAuditEvent>(
  event: TEvent,
  dependencies: AuditHashDependencies,
): TEvent & Pick<AuditBase, 'eventHash'> => ({
  ...event,
  eventHash: buildCredentialAuditEventHash(event, dependencies),
});

export const createCredentialUsePlanned = (
  input: CredentialUsePlannedInput,
  dependencies: AuditHashDependencies,
): CredentialUsePlanned =>
  finalizeAuditEvent(
    {
      type: 'CredentialUsePlanned',
      ...cloneAuditSeed(input.audit),
      egressPolicyId: input.egressPolicyId,
      expiresAt: input.expiresAt,
      reason: input.reason,
    },
    dependencies,
  );

export const createCredentialUseStarted = (
  input: CredentialUseStartedInput,
  dependencies: AuditHashDependencies,
): CredentialUseStarted =>
  finalizeAuditEvent(
    {
      type: 'CredentialUseStarted',
      ...cloneAuditSeed(input.audit),
      injectionModes: [...input.injectionModes],
      redactionFingerprintIds: [...input.redactionFingerprintIds],
    },
    dependencies,
  );

export const createCredentialUseFinished = (
  input: CredentialUseFinishedInput,
  dependencies: AuditHashDependencies,
): CredentialUseFinished =>
  finalizeAuditEvent(
    {
      type: 'CredentialUseFinished',
      ...cloneAuditSeed(input.audit),
      result: input.result,
      ...(input.providerStatus === undefined ? {} : { providerStatus: input.providerStatus }),
      ...(input.exitCode === undefined ? {} : { exitCode: input.exitCode }),
      destroyed: input.destroyed,
    },
    dependencies,
  );

export const createCredentialUseDenied = (
  input: CredentialUseDeniedInput,
  dependencies: AuditHashDependencies,
): CredentialUseDenied =>
  finalizeAuditEvent(
    {
      type: 'CredentialUseDenied',
      ...cloneAuditSeed(input.audit),
      reason: input.reason,
    },
    dependencies,
  );

export const createCredentialMaterialDestroyed = (
  input: CredentialMaterialDestroyedInput,
  dependencies: AuditHashDependencies,
): CredentialMaterialDestroyed =>
  finalizeAuditEvent(
    {
      type: 'CredentialMaterialDestroyed',
      ...cloneAuditSeed(input.audit),
      tempFilesRemoved: input.tempFilesRemoved,
      memoryHandlesDropped: input.memoryHandlesDropped,
    },
    dependencies,
  );

export const createRedactionApplied = (
  input: RedactionAppliedInput,
  dependencies: AuditHashDependencies,
): RedactionApplied =>
  finalizeAuditEvent(
    {
      type: 'RedactionApplied',
      ...cloneAuditSeed(input.audit),
      sink: input.sink,
      replacementCount: input.replacementCount,
      redactionFingerprintIds: [...input.redactionFingerprintIds],
    },
    dependencies,
  );

export const createEgressPolicyIssued = (
  input: EgressPolicyIssuedInput,
  dependencies: AuditHashDependencies,
): EgressPolicyIssued =>
  finalizeAuditEvent(
    {
      type: 'EgressPolicyIssued',
      ...cloneAuditSeed(input.audit),
      policyId: input.policyId,
      egressPolicyDigest: input.egressPolicyDigest,
      audience: input.audience,
      hosts: [...input.hosts],
      negativeProbeIds: [...input.negativeProbeIds],
      freshnessKey: input.freshnessKey,
      expiresAt: input.expiresAt,
    },
    dependencies,
  );

export const destroy = (
  operationId: string,
  context: DestroyCredentialMaterialContext,
  dependencies: AuditHashDependencies,
): CredentialMaterialDestroyed =>
  createCredentialMaterialDestroyed(
    {
      audit: {
        ...cloneAuditSeed({
          ...context.audit,
          operationId,
        }),
      },
      tempFilesRemoved: context.tempFilesRemoved,
      memoryHandlesDropped: context.memoryHandlesDropped,
    },
    dependencies,
  );
