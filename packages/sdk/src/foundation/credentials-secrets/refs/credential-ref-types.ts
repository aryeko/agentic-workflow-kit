import type { Result } from '../../configuration-policy/index.js';
import type { CredentialRefSource } from '../../configuration-policy/schema/index.js';

export type CredentialKind = CredentialRefSource['kind'];
export type CredentialParty = CredentialRefSource['allowedParties'][number];
export type InjectionMode = 'env' | 'file';
export type EnforcementPoint = 'execution-host';

export type SecretRef = {
  readonly id: string;
  readonly source: CredentialRefSource['secret']['source'];
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
  readonly ttlSeconds: number;
  readonly policyDigest: string;
};

export type SecretRefInspectionReason = 'missing' | 'inaccessible' | 'ambiguous' | 'unsupported';

export type SecretRefInspection =
  | {
      readonly ok: true;
    }
  | {
      readonly ok: false;
      readonly reason: SecretRefInspectionReason;
    };

export type CredentialRefValidationReport = {
  readonly policyDigest: string;
  readonly refs: readonly CredentialRef[];
};

export type CredentialRefValidationFailure = {
  readonly token: 'credential-ref-unresolved';
  readonly reason: SecretRefInspectionReason;
  readonly credentialRefId: string;
  readonly secretRef: SecretRef;
  readonly policyDigest: string;
};

export type CredentialRefValidationResult = Result<CredentialRefValidationReport, CredentialRefValidationFailure>;

export type ValidateCredentialRefsDependencies = {
  readonly hashText: (value: string) => string;
  readonly inspectSecretRef: (ref: SecretRef) => SecretRefInspection;
};
