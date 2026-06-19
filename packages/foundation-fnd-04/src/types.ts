import type { PolicyLayer, Result } from '@kit-vnext/foundation-fnd-01';

export type CredentialKind = 'forge' | 'registry-read' | 'registry-publish' | 'tool-api' | 'verification';
export type CredentialParty = 'runner' | 'worker';
export type InjectionMode = 'env' | 'file';
export type EnforcementPoint = 'execution-host';
export type EgressProtocol = 'https' | 'ssh';

export type CredentialDenialReason =
  | 'credential-ref-unresolved'
  | 'credential-scope-denied'
  | 'worker-forge-credential-denied'
  | 'egress-policy-unattested'
  | 'redaction-unavailable'
  | 'audit-write-unavailable';

export type CredentialFailureMode =
  | CredentialDenialReason
  | 'credential-destroy-unconfirmed'
  | 'artifact-redaction-failed';

export type SecretRef = {
  readonly id: string;
  readonly source: 'env' | 'secret-manager';
  readonly key: string;
  readonly version?: string;
};

export type CredentialRef = {
  readonly id: string;
  readonly kind: CredentialKind;
  readonly purpose: string;
  readonly secret: SecretRef;
  readonly allowedParties: readonly CredentialParty[];
  readonly allowedPhases: readonly string[];
  readonly allowedHosts: readonly string[];
  readonly allowedCommandPrefixes?: readonly string[];
  readonly ttlSeconds: number;
  readonly policyDigest: string;
};

export type CredentialRefSource = PolicyLayer['credentialRefs']['refs'][number];
export type EgressSource = PolicyLayer['egress'];

export type CredentialScope = {
  readonly runId: string;
  readonly taskId: string;
  readonly operationId: string;
  readonly party: CredentialParty;
  readonly phase: string;
  readonly hosts?: readonly string[];
  readonly commandPrefix?: string;
  readonly processId?: string;
  readonly expiresAt: string;
  readonly grantEventId?: string;
};

export type EgressRule = {
  readonly credentialRefIds: readonly string[];
  readonly protocols: readonly EgressProtocol[];
  readonly hosts: readonly string[];
  readonly ports?: readonly number[];
  readonly phase: string;
  readonly purpose: string;
};

export type RequiredAttester = {
  readonly point: EnforcementPoint;
  readonly capability: 'egress-confinement';
  readonly driverId: string;
  readonly scopeDigest: string;
  readonly egressPolicyDigest: string;
  readonly platform: string;
  readonly driverVersion: string;
};

export type NegativeProbe = {
  readonly id: string;
  readonly host: string;
  readonly protocol: EgressProtocol;
  readonly expected: 'blocked';
  readonly reason: string;
};

export type EgressPolicy = {
  readonly id: string;
  readonly runId: string;
  readonly operationId: string;
  readonly audience: CredentialParty;
  readonly egressPolicyDigest: string;
  readonly defaultAction: 'deny';
  readonly rules: readonly EgressRule[];
  readonly negativeProbes: readonly NegativeProbe[];
  readonly requiredAttesters: readonly RequiredAttester[];
  readonly freshnessKey: string;
  readonly expiresAt: string;
};

export type EgressAttesterMetadata = {
  readonly platform: string;
  readonly driverVersion: string;
};

export type EgressCapabilityAttestation = {
  readonly eventId: string;
  readonly capability: 'egress-confinement';
  readonly result: 'positive' | 'negative';
  readonly point: EnforcementPoint;
  readonly driverId: string;
  readonly scopeDigest: string;
  readonly egressPolicyDigest: string;
  readonly freshnessKey: string;
  readonly platform: string;
  readonly driverVersion: string;
  readonly expiresAt: string;
  readonly evidenceRef: string;
  readonly negativeProbeIds: readonly string[];
};

export type RedactionSet = {
  readonly id: string;
  readonly state: 'planned' | 'materialized';
  readonly credentialRefIds: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
  readonly fingerprintIds: readonly string[];
  readonly expiresAt: string;
};

export type InjectionBinding = {
  readonly mode: InjectionMode;
  readonly nameOrPath: string;
  readonly redactionLabel: string;
};

export type ProcessOutputChunk = {
  readonly stream: 'stdout' | 'stderr';
  readonly text: string;
};

export type TextArtifact = {
  readonly artifactId: string;
  readonly mediaType: 'text/plain' | 'application/json';
  readonly text: string;
};

export type RedactableScalar = string | number | boolean | null;
export type RedactedInput =
  | RedactableScalar
  | ProcessOutputChunk
  | TextArtifact
  | readonly RedactedInput[]
  | { readonly [key: string]: RedactedInput };

export type AuditBase = {
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
  readonly eventHash: string;
  readonly at: string;
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

export type CredentialDenied = {
  readonly ok: false;
  readonly reason: CredentialDenialReason;
  readonly auditEvent: CredentialUseDenied;
};

export type ResolvedCredential = {
  readonly ok: true;
  readonly credentialRefId: string;
  readonly materialHandle: string;
  readonly redactionSet: RedactionSet;
  readonly auditEvent: CredentialUseStarted;
};

export type InjectionPlan = {
  readonly ok: true;
  readonly operationId: string;
  readonly party: CredentialParty;
  readonly bindings: readonly InjectionBinding[];
  readonly credentialRefIds: readonly string[];
  readonly egressPolicy: EgressPolicy;
  readonly redactionSet: RedactionSet;
  readonly requiredAuditEvent: CredentialUsePlanned;
};

export type RedactedValue<T extends RedactedInput = RedactedInput> = {
  readonly ok: true;
  readonly value: T;
  readonly replacementCount: number;
  readonly redactionFingerprintIds: readonly string[];
  readonly auditEvent: RedactionApplied;
};

export type ResolveCredentialResult = ResolvedCredential | CredentialDenied;
export type PlanInjectionResult = InjectionPlan | CredentialDenied;
export type RedactResult<T extends RedactedInput = RedactedInput> = RedactedValue<T> | CredentialDenied;
export type IssueEgressPolicyResult = EgressPolicy | CredentialDenied;

export type SecretMaterial = {
  readonly materialHandle: string;
  readonly material: string;
};

export type SecretResolver = {
  resolve(ref: CredentialRef): Result<SecretMaterial, 'credential-ref-unresolved'>;
  destroy?(materialHandle: string): Result<void, 'credential-destroy-unconfirmed'>;
};

export type CredentialClock = {
  now(): Date;
};

export type IdGenerator = {
  nextId(purpose: string): string;
};

export type AuditWriter = {
  append(event: CredentialAuditEvent): Result<void, 'audit-write-unavailable'>;
};

export type TempFileRemover = {
  remove(paths: readonly string[]): Result<void, 'credential-destroy-unconfirmed'>;
};

export type FinishCredentialUseInput = {
  readonly result: 'success' | 'failure';
  readonly providerStatus?: string;
  readonly exitCode?: number;
};

export type CredentialsAndSecretsContract = {
  resolveCredential(ref: CredentialRef, scope: CredentialScope): ResolveCredentialResult;
  planInjection(refs: readonly CredentialRef[], scope: CredentialScope): PlanInjectionResult;
  redact<T extends RedactedInput>(value: T, redactionSet: RedactionSet): RedactResult<T>;
  destroy(operationId: string): CredentialMaterialDestroyed;
  issueEgressPolicy(refs: readonly CredentialRef[], scope: CredentialScope): IssueEgressPolicyResult;
  finishCredentialUse(operationId: string, input: FinishCredentialUseInput): CredentialUseFinished;
};

export type CredentialsAndSecretsOptions = {
  readonly clock: CredentialClock;
  readonly idGenerator: IdGenerator;
  readonly fingerprintKey: string;
  readonly secretResolver: SecretResolver;
  readonly egress: EgressSource;
  readonly attesterMetadata: Readonly<Record<string, EgressAttesterMetadata>>;
  readonly attestations?: readonly EgressCapabilityAttestation[];
  readonly auditWriter?: AuditWriter;
  readonly tempFileRemover?: TempFileRemover;
  readonly runnerForgePhases?: readonly string[];
  readonly injectionModeFor?: (ref: CredentialRef, scope: CredentialScope) => InjectionMode;
};
