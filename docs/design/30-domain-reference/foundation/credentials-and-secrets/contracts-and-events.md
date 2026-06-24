---
title: "Credentials & Secrets -- contracts and events"
status: draft
last-reviewed: 2026-06-18
---

# Contracts and events

This file holds the typed contract and audit payload details for
`design/30-domain-reference/foundation/credentials-and-secrets/README.md`. It is split out because the type
catalog is cohesive detail and would otherwise push the design entry point past the focused-file cap.
`CredentialRef` and `EgressPolicy` are the fnd-04 validated contract forms of fnd-01
`credentialRefs` and `egress` source policy fields; fnd-01 records source provenance, while fnd-04
computes policy digests and denies use when a source field would exceed this contract.

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
  egressPolicyDigest: string;
  defaultAction: "deny"; rules: EgressRule[]; negativeProbes: NegativeProbe[];
  requiredAttesters: RequiredAttester[]; freshnessKey: string; expiresAt: string;
}
interface EgressRule {
  credentialRefIds: string[]; protocols: ("https" | "ssh")[]; hosts: string[];
  ports?: number[]; phase: string; purpose: string;
}
interface RequiredAttester {
  // `point`, `capability`, `driverId` come from the fnd-01 `RequiredAttesterSource`; `scopeDigest`
  // and `egressPolicyDigest` are computed by fnd-04. `platform` and `driverVersion` are NOT declared
  // here — they are runtime facts of the attesting Execution Host driver, matched at credential
  // release time against the Host `CapabilityAttestation` (see README release-match rule), not values
  // config or fnd-04 can produce.
  point: EnforcementPoint; capability: "egress-confinement"; driverId: string;
  scopeDigest: string; egressPolicyDigest: string;
}
interface NegativeProbe { host: string; protocol: "https" | "ssh"; expected: "blocked"; reason: string }
```

```ts
interface CredentialDenied { ok: false; reason: CredentialDenialReason; auditEvent: CredentialUseDenied }
interface ResolvedCredential {
  ok: true; credentialRefId: string; materialHandle: string; redactionSet: RedactionSet;
  auditEvent: CredentialUseStarted;
}
// `mode` and `nameOrPath` are derived by `planInjection` from the credential's `kind`/`purpose` per
// the README injection rules (env var for tokens, file path for key material), keyed per `CredentialRef`;
// `redactionLabel` is the credential's redaction label from the `RedactionSet`.
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
// Injected on every method so fnd-04 produces complete `AuditBase` records without reading ambient
// time or guessing identity. `scope` carries runId/taskId/operationId/party/phase/grantEventId;
// `attestationEventIds`/`evidenceRefs` are the matching fresh `CapabilityAttestation` event ids and
// their evidence refs; `occurredAt` is the injected audit timestamp (fnd-04 never reads ambient time,
// mirroring fnd-01 `ResolutionContext.occurredAt`).
interface CredentialAuditContext {
  scope: CredentialScope;
  attestationEventIds: string[];
  evidenceRefs: string[];
  occurredAt: string;
}

interface CredentialsAndSecretsContract {
  resolveCredential(ref: CredentialRef, ctx: CredentialAuditContext): ResolveCredentialResult;
  planInjection(refs: CredentialRef[], ctx: CredentialAuditContext): PlanInjectionResult;
  redact<T extends RedactedInput>(value: T, redactionSet: RedactionSet, ctx: CredentialAuditContext): RedactResult<T>;
  destroy(ctx: CredentialAuditContext): CredentialMaterialDestroyed;
  // `source` is the fnd-01 `EgressPolicySource` (rules/negativeProbes/requiredAttesters); fnd-04
  // validates it into `EgressPolicy` and computes digests. Without it the produced policy's rules,
  // probes, and attesters would have no source.
  issueEgressPolicy(refs: CredentialRef[], source: EgressPolicySource, ctx: CredentialAuditContext): EgressPolicy | CredentialDenied;
}
```

```ts
interface AuditBase {
  // Every AuditBase field has a declared source: `runId`/`taskId`/`operationId`/`party`/`phase`/
  // `grantEventId` from `ctx.scope`; `credentialRefIds` from the call's refs; `attestationEventIds`/
  // `evidenceRefs` from `ctx`; `at` from `ctx.occurredAt`; `policyDigest`/`credentialRefDigest`/
  // `scopeDigest` computed by fnd-04 from the ref(s)/scope. fnd-04 reads no ambient time.
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
interface EgressPolicyIssued extends AuditBase { type: "EgressPolicyIssued"; policyId: string; egressPolicyDigest: string; audience: CredentialParty; hosts: string[]; negativeProbeIds: string[]; freshnessKey: string; expiresAt: string }
type CredentialAuditEvent = CredentialUsePlanned | CredentialUseStarted | CredentialUseFinished | CredentialUseDenied | CredentialMaterialDestroyed | RedactionApplied | EgressPolicyIssued;
```

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Credentials & Secrets](./README.md) · **← Prev:** [Credentials & Secrets](./README.md) · **Next →:** [provider domain reference](../../providers/README.md)

<!-- /DOCS-NAV -->
