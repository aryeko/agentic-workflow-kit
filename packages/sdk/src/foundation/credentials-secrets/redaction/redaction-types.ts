import type { AuditHashDependencies, AuditSeed, RedactionApplied } from '../audit/index.js';
import type { CredentialDenied, CredentialFailureToken } from '../failures/index.js';

export type RedactionSet = {
  readonly id: string;
  readonly credentialRefIds: readonly string[];
  readonly labels: Readonly<Record<string, string>>;
  readonly fingerprintIds: readonly string[];
  readonly expiresAt: string;
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
  | {
      readonly [key: string]: RedactedInput;
    };

export type RedactedValue<T extends RedactedInput = RedactedInput> = {
  readonly ok: true;
  readonly value: T;
  readonly replacementCount: number;
  readonly redactionFingerprintIds: readonly string[];
  readonly auditEvent: RedactionApplied;
};

export type RedactResult<T extends RedactedInput = RedactedInput> = RedactedValue<T> | CredentialDenied;

export type CreateRedactionSetSecret = {
  readonly credentialRefId: string;
  readonly label: string;
  readonly fingerprintId: string;
  readonly secret: string;
  readonly tempFilePaths?: readonly string[];
};

export type CreateRedactionSetInput = {
  readonly id: string;
  readonly expiresAt: string;
  readonly secrets: readonly CreateRedactionSetSecret[];
};

export type RedactInput<T extends RedactedInput = RedactedInput> = {
  readonly value: T;
  readonly redactionSet?: RedactionSet;
  readonly audit: AuditSeed;
  readonly sink: string;
};

export type ArtifactRedactionCandidate =
  | TextArtifact
  | {
      readonly artifactId: string;
      readonly mediaType: string;
      readonly text?: string;
    };

export type RedactArtifactInput = {
  readonly artifact: ArtifactRedactionCandidate;
  readonly redactionSet?: RedactionSet;
  readonly audit: AuditSeed;
  readonly sink?: string;
};

export type ArtifactRedactionFailureReason = 'binary-media-type' | 'text-unavailable';

export type ArtifactRedactionFailure = {
  readonly ok: false;
  readonly token: Extract<CredentialFailureToken, 'artifact-redaction-failed'>;
  readonly artifactId: string;
  readonly mediaType: string;
  readonly reason: ArtifactRedactionFailureReason;
};

export type ArtifactRedactionResult = RedactedValue<TextArtifact> | CredentialDenied | ArtifactRedactionFailure;

export type RedactionDependencies = AuditHashDependencies;
