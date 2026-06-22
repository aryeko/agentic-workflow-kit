import type { CredentialParty, InjectionMode } from '../refs/index.js';
import type { CredentialDenialReason } from '../failures/denial-reasons.js';

export type AuditHashDependencies = {
  readonly hashText: (value: string) => string;
};

export type AuditSeed = {
  readonly runId: string;
  readonly taskId: string;
  readonly operationId: string;
  readonly credentialRefIds: readonly string[];
  readonly party: CredentialParty;
  readonly phase: string;
  readonly policyDigest: string;
  readonly credentialRefDigest: string;
  readonly scopeDigest: string;
  readonly grantEventId?: string;
  readonly attestationEventIds: readonly string[];
  readonly evidenceRefs: readonly string[];
  readonly prevEventHash: string;
  readonly at: string;
};

export type AuditBase = AuditSeed & {
  readonly eventHash: string;
};

export type CredentialUsePlanned = AuditBase & {
  readonly type: 'CredentialUsePlanned';
  readonly egressPolicyId: string;
  readonly expiresAt: string;
  readonly reason: string;
};

export type CredentialUseStarted = AuditBase & {
  readonly type: 'CredentialUseStarted';
  readonly injectionModes: readonly InjectionMode[];
  readonly redactionFingerprintIds: readonly string[];
};

export type CredentialUseFinished = AuditBase & {
  readonly type: 'CredentialUseFinished';
  readonly result: 'success' | 'failure';
  readonly providerStatus?: string;
  readonly exitCode?: number;
  readonly destroyed: boolean;
};

export type CredentialUseDenied = AuditBase & {
  readonly type: 'CredentialUseDenied';
  readonly reason: CredentialDenialReason;
};

export type CredentialMaterialDestroyed = AuditBase & {
  readonly type: 'CredentialMaterialDestroyed';
  readonly tempFilesRemoved: boolean;
  readonly memoryHandlesDropped: boolean;
};

export type RedactionApplied = AuditBase & {
  readonly type: 'RedactionApplied';
  readonly sink: string;
  readonly replacementCount: number;
  readonly redactionFingerprintIds: readonly string[];
};

export type EgressPolicyIssued = AuditBase & {
  readonly type: 'EgressPolicyIssued';
  readonly policyId: string;
  readonly egressPolicyDigest: string;
  readonly audience: CredentialParty;
  readonly hosts: readonly string[];
  readonly negativeProbeIds: readonly string[];
  readonly freshnessKey: string;
  readonly expiresAt: string;
};

export type CredentialAuditEvent =
  | CredentialUsePlanned
  | CredentialUseStarted
  | CredentialUseFinished
  | CredentialUseDenied
  | CredentialMaterialDestroyed
  | RedactionApplied
  | EgressPolicyIssued;

export type CredentialUsePlannedInput = {
  readonly audit: AuditSeed;
  readonly egressPolicyId: string;
  readonly expiresAt: string;
  readonly reason: string;
};

export type CredentialUseStartedInput = {
  readonly audit: AuditSeed;
  readonly injectionModes: readonly InjectionMode[];
  readonly redactionFingerprintIds: readonly string[];
};

export type CredentialUseFinishedInput = {
  readonly audit: AuditSeed;
  readonly result: CredentialUseFinished['result'];
  readonly providerStatus?: string;
  readonly exitCode?: number;
  readonly destroyed: boolean;
};

export type CredentialUseDeniedInput = {
  readonly audit: AuditSeed;
  readonly reason: CredentialDenialReason;
};

export type CredentialMaterialDestroyedInput = {
  readonly audit: AuditSeed;
  readonly tempFilesRemoved: boolean;
  readonly memoryHandlesDropped: boolean;
};

export type DestroyCredentialMaterialContext = {
  readonly audit: Omit<AuditSeed, 'operationId'>;
  readonly tempFilesRemoved: boolean;
  readonly memoryHandlesDropped: boolean;
};

export type RedactionAppliedInput = {
  readonly audit: AuditSeed;
  readonly sink: string;
  readonly replacementCount: number;
  readonly redactionFingerprintIds: readonly string[];
};

export type EgressPolicyIssuedInput = {
  readonly audit: AuditSeed;
  readonly policyId: string;
  readonly egressPolicyDigest: string;
  readonly audience: CredentialParty;
  readonly hosts: readonly string[];
  readonly negativeProbeIds: readonly string[];
  readonly freshnessKey: string;
  readonly expiresAt: string;
};
