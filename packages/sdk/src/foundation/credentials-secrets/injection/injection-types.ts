import type { CredentialUsePlanned, CredentialUseStarted } from '../audit/index.js';
import type { CredentialDenied } from '../failures/index.js';
import type { CredentialKind, CredentialParty, CredentialRef, InjectionMode } from '../refs/index.js';
import type { RedactionSet } from '../redaction/index.js';
import type { CredentialScope } from '../scopes/index.js';
import type { EgressAttestation, EgressPolicy } from '../egress/index.js';

export type InjectionBinding = {
  readonly mode: InjectionMode;
  readonly nameOrPath: string;
  readonly redactionLabel: string;
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

export type PlanInjectionResult = InjectionPlan | CredentialDenied;

export type ResolvedCredential = {
  readonly ok: true;
  readonly credentialRefId: string;
  readonly materialHandle: string;
  readonly redactionSet: RedactionSet;
  readonly auditEvent: CredentialUseStarted;
};

export type ResolveCredentialResult = ResolvedCredential | CredentialDenied;

export type CredentialBindingTemplate = {
  readonly credentialRefId: string;
  readonly mode: InjectionMode;
  readonly nameOrPath: string;
};

export type CredentialGrant = {
  readonly allowedParties?: readonly CredentialParty[];
  readonly allowedPhases?: readonly string[];
  readonly allowedHosts?: readonly string[];
  readonly commandPrefix?: string;
  readonly expiresAt?: string;
  readonly injectionModes?: readonly InjectionMode[];
  readonly egressPolicyDigest?: string;
  readonly credentialKinds?: readonly CredentialKind[];
};

export type ResolvedSecretMaterial = {
  readonly material: string;
  readonly materialHandle: string;
  readonly fingerprintId: string;
  readonly tempFilePaths?: readonly string[];
};

export type PlanInjectionInput = {
  readonly refs: readonly CredentialRef[];
  readonly scope: CredentialScope;
  readonly bindingTemplates: readonly CredentialBindingTemplate[];
  readonly egressSource: import('../../configuration-policy/index.js').EgressPolicySource;
  readonly grant?: CredentialGrant;
};

export type SharedCredentialOperationDependencies = {
  readonly hashText: (value: string) => string;
  readonly now: string;
  readonly issuedAt: string;
  readonly host?: string;
  readonly command?: string;
  readonly at: string;
  readonly prevEventHash: string;
  readonly auditSinkAvailable: boolean;
  readonly resolveSecretMaterial: (ref: CredentialRef) => ResolvedSecretMaterial | undefined;
};

export type PlanInjectionDependencies = SharedCredentialOperationDependencies;

export type ResolveCredentialInput = {
  readonly ref: CredentialRef;
  readonly scope: CredentialScope;
  readonly egressConfinementRequired: boolean;
  readonly requiredAuditEvent?: CredentialUsePlanned;
  readonly redactionSet?: RedactionSet;
  readonly egressPolicy?: EgressPolicy;
  readonly injectionModes: readonly InjectionMode[];
  readonly attestations?: readonly EgressAttestation[];
  readonly attestationIds?: readonly string[];
};

export type ResolveCredentialDependencies = SharedCredentialOperationDependencies;
