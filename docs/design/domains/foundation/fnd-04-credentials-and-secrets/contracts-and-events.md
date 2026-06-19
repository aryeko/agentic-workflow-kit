---
title: "Credentials & Secrets -- contracts and events"
status: draft
last-reviewed: 2026-06-18
---

# Contracts and events

This file holds the typed contract and audit payload details for
`docs/design/domains/foundation/fnd-04-credentials-and-secrets/README.md`. It is split out because the type
catalog is cohesive detail and would otherwise push the design entry point past the focused-file cap.

```ts
type CredentialKind = "forge" | "registry-read" | "registry-publish" | "tool-api" | "verification";
type CredentialParty = "runner" | "worker";
type InjectionMode = "env" | "file";
type EnforcementPoint = "execution-host";
type CredentialDenialReason =
  | "credential-ref-unresolved" | "credential-scope-denied" | "worker-forge-credential-denied"
  | "egress-policy-unattested" | "redaction-unavailable" | "audit-write-unavailable";

interface SecretRef { id: string; source: "env" | "secret-manager"; key: string; version?: string }
interface CredentialRef {
  id: string; kind: CredentialKind; purpose: string; secret: SecretRef;
  allowedParties: CredentialParty[]; allowedPhases: string[]; allowedHosts: string[];
  ttlSeconds: number; policyDigest: string;
}
interface CredentialScope {
  runId: string; taskId: string; operationId: string; party: CredentialParty; phase: string;
  commandPrefix?: string; processId?: string; expiresAt: string; grantEventId?: string;
}
```

```ts
interface EgressPolicy {
  id: string; runId: string; operationId: string; audience: CredentialParty;
  defaultAction: "deny"; rules: EgressRule[]; negativeProbes: NegativeProbe[];
  requiredAttesters: RequiredAttester[]; freshnessKey: string; expiresAt: string;
}
interface EgressRule {
  credentialRefIds: string[]; protocols: ("https" | "ssh")[]; hosts: string[];
  ports?: number[]; phase: string; purpose: string;
}
interface RequiredAttester {
  point: EnforcementPoint; capability: "egress-confinement"; driverId: string;
  scopeDigest: string; platform: string; driverVersion: string;
}
interface NegativeProbe { host: string; protocol: "https" | "ssh"; expected: "blocked"; reason: string }
```

```ts
interface CredentialDenied { ok: false; reason: CredentialDenialReason; auditEvent: CredentialUseDenied }
interface ResolvedCredential {
  ok: true; credentialRefId: string; materialHandle: string; redactionSet: RedactionSet;
  auditEvent: CredentialUseStarted;
}
interface InjectionBinding { mode: InjectionMode; nameOrPath: string; redactionLabel: string }
interface InjectionPlan {
  ok: true; operationId: string; party: CredentialParty; bindings: InjectionBinding[];
  credentialRefIds: string[]; egressPolicy: EgressPolicy; redactionSet: RedactionSet;
  requiredAuditEvent: CredentialUsePlanned;
}
interface RedactionSet {
  id: string; credentialRefIds: string[]; labels: Record<string, string>;
  fingerprintIds: string[]; expiresAt: string;
}

interface ProcessOutputChunk { stream: "stdout" | "stderr"; text: string }
interface TextArtifact { artifactId: string; mediaType: "text/plain" | "application/json"; text: string }
type RedactableScalar = string | number | boolean | null;
type RedactedInput =
  | RedactableScalar
  | ProcessOutputChunk
  | TextArtifact
  | RedactedInput[]
  | { [key: string]: RedactedInput };
interface RedactedValue<T extends RedactedInput = RedactedInput> {
  ok: true; value: T; replacementCount: number; redactionFingerprintIds: string[];
  auditEvent: RedactionApplied;
}

type ResolveCredentialResult = ResolvedCredential | CredentialDenied;
type PlanInjectionResult = InjectionPlan | CredentialDenied;
type RedactResult<T extends RedactedInput = RedactedInput> = RedactedValue<T> | CredentialDenied;
```

```ts
interface CredentialsAndSecretsContract {
  resolveCredential(ref: CredentialRef, scope: CredentialScope): ResolveCredentialResult;
  planInjection(refs: CredentialRef[], scope: CredentialScope): PlanInjectionResult;
  redact<T extends RedactedInput>(value: T, redactionSet: RedactionSet): RedactResult<T>;
  destroy(operationId: string): CredentialMaterialDestroyed;
  issueEgressPolicy(refs: CredentialRef[], scope: CredentialScope): EgressPolicy | CredentialDenied;
}
```

```ts
interface AuditBase {
  runId: string; taskId: string; operationId: string; credentialRefIds: string[];
  party: CredentialParty; phase: string; policyDigest: string; credentialRefDigest: string;
  scopeDigest: string; grantEventId?: string; attestationEventIds: string[]; evidenceRefs: string[];
  // Global ordering and writer identity come from the core-01 RunEventEnvelope.
  // This hash chain is payload-local over prior credential-audit events only.
  prevEventHash: string; eventHash: string; at: string;
}
interface CredentialUsePlanned extends AuditBase { type: "CredentialUsePlanned"; egressPolicyId: string; expiresAt: string; reason: string }
interface CredentialUseStarted extends AuditBase { type: "CredentialUseStarted"; injectionModes: InjectionMode[]; redactionFingerprintIds: string[] }
interface CredentialUseFinished extends AuditBase { type: "CredentialUseFinished"; result: "success" | "failure"; providerStatus?: string; exitCode?: number; destroyed: boolean }
interface CredentialUseDenied extends AuditBase { type: "CredentialUseDenied"; reason: CredentialDenialReason }
interface CredentialMaterialDestroyed extends AuditBase { type: "CredentialMaterialDestroyed"; tempFilesRemoved: boolean; memoryHandlesDropped: boolean }
interface RedactionApplied extends AuditBase { type: "RedactionApplied"; sink: string; replacementCount: number; redactionFingerprintIds: string[] }
interface EgressPolicyIssued extends AuditBase { type: "EgressPolicyIssued"; policyId: string; audience: CredentialParty; hosts: string[]; negativeProbeIds: string[]; freshnessKey: string; expiresAt: string }
type CredentialAuditEvent = CredentialUsePlanned | CredentialUseStarted | CredentialUseFinished | CredentialUseDenied | CredentialMaterialDestroyed | RedactionApplied | EgressPolicyIssued;
```
