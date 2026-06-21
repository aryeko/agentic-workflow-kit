---
title: "DRAFT — ResolvedPolicy consumed-block contract (T1 proposal)"
status: proposal-not-applied
owner: "T1 sub-agent (design-closure wave-1)"
note: >
  This is a PROPOSED draft for review. It is NOT a corpus file and amends nothing.
  It freezes the field names/types of the fnd-01 PolicyLayer blocks that core-02,
  core-03, and core-05 consume. Every type below is either copied verbatim from
  the current corpus or is a proposed addition explicitly flagged as CHANGE/ADD.
---

# ResolvedPolicy — frozen consumed-block contract (proposed)

`ResolvedPolicy` is unchanged from
`docs/design/30-domain-reference/foundation/configuration-and-policy/interfaces-events-and-verification.md`:

```ts
type ResolvedPolicy = {
  schema: "kit-vnext.resolved-policy.v1";
  policy: PolicyLayer;
  provenance: Record<string, FieldProvenance>;
};
```

Consumers reach fields by the path `ResolvedPolicy.policy.<block>.<field>`.

## PolicyLayer — block key names (frozen)

Verbatim from `schema-and-resolution.md` lines 37–47. The consumed block KEYS are frozen as:

```ts
type PolicyLayer = {
  run: RunPolicy;
  provisioning: ProvisioningPolicy;
  approval: ApprovalPolicy;              // consumed by core-03
  escalationPolicy: EscalationPolicy;    // consumed by core-03
  changePolicy: ChangePolicy;            // consumed by core-05
  capabilities: CapabilityPolicy;        // consumed by core-02
  credentialRefs: CredentialReferencePolicy;
  egress: EgressPolicySource;
  merge: MergePolicy;                    // consumed by core-05  (KEY IS `merge`, NOT `mergePolicy`)
};
```

> FROZEN NAMING RULING (see proposal.md §Decision): the `MergePolicy` block is reached at
> `ResolvedPolicy.policy.merge`, NOT `…​.mergePolicy`. Consumer prose that writes
> `mergePolicy.requiredEvidence` must be read as the type `MergePolicy.requiredEvidence`
> reached via the layer key `merge`.

## capabilities — `CapabilityPolicy` (CHANGE proposed)

Current corpus (`schema-and-resolution.md` 134–142):

```ts
type CapabilityPolicy = {
  "auto-merge": CapabilitySetting;
  "auto-recover": CapabilitySetting;
  "unattended-run": CapabilitySetting;
};
type CapabilitySetting = {
  desired: boolean;
  requireFreshAttestation: true;
};
```

PROPOSED CHANGE — make the map total over the v1 non-deferred `CapabilityId` set so core-02's
`policy-disallows-capability` predicate has an exact field path for EVERY gated capability:

```ts
// ADD: escalation-auto-grant key so core-03's escalation gate has a policy field.
//      orchestrator-decide is intentionally absent (AD-14 deferred; setting it is rejected).
type CapabilityPolicy = {
  "auto-merge": CapabilitySetting;
  "auto-recover": CapabilitySetting;
  "unattended-run": CapabilitySetting;
  "escalation-auto-grant": CapabilitySetting;   // ADD
};
type CapabilitySetting = {
  desired: boolean;                 // the assisted-enable bit the policy predicate reads
  requireFreshAttestation: true;
};
```

core-02 `policy-disallows-capability` predicate field path (frozen):
`ResolvedPolicy.policy.capabilities[capabilityId].desired === true`.
A capability whose key is absent or whose `desired` is `false` → `policy-disallows-capability` deny.

## approval — `ApprovalPolicy` (CHANGE proposed: add decision window)

Current corpus (`schema-and-resolution.md` 72–76):

```ts
type ApprovalPolicy = {
  mode: "manual" | "assisted";
  parkOnHumanLatency: boolean;
  requireRecordedDecision: boolean;
};
```

PROPOSED CHANGE — name the decision-window field core-03 needs for `expired` (the open question in
both fnd-01 §10 and core-03 §10). Recommended name + type:

```ts
type ApprovalPolicy = {
  mode: "manual" | "assisted";
  parkOnHumanLatency: boolean;
  requireRecordedDecision: boolean;
  decisionWindowMs: number;        // ADD: live-answer/decision window before `expired`
};
```

core-03 field paths (frozen):
- mode  → `ResolvedPolicy.policy.approval.mode`
- decision window → `ResolvedPolicy.policy.approval.decisionWindowMs`

## escalationPolicy — `EscalationPolicy` (NO CHANGE; fields already named)

Verbatim from `schema-and-resolution.md` 78–88. core-03 already reads these names:

```ts
type EscalationPolicy = {
  allowedGrantScopes: Array<"per-command" | "per-command-prefix" | "per-host" | "session">;
  maxGrantScope: "per-command" | "per-command-prefix" | "per-host" | "session";
  denyByDefault: boolean;
  grantRules: Array<{
    reason: "dependency-install" | "verification" | "worker-tool" | "other";
    scope: "per-command" | "per-command-prefix";
    prefixes?: string[];
    requiresOperator?: boolean;
  }>;
};
```

core-03 risk/grant field paths (frozen):
- `ResolvedPolicy.policy.escalationPolicy.maxGrantScope`   (high-risk rule: scope broader than this)
- `ResolvedPolicy.policy.escalationPolicy.grantRules[].prefixes` (allowlist prefix match)
- `ResolvedPolicy.policy.escalationPolicy.grantRules[].requiresOperator` (medium-risk rule)
- `ResolvedPolicy.policy.escalationPolicy.allowedGrantScopes`, `.denyByDefault`

> "risk" is NOT a standalone policy block. Risk is core-03-computed (decision-model.md). Its policy
> INPUTS are `escalationPolicy.maxGrantScope` and `grantRules`. AC-2's "risk" field is satisfied by
> these named escalation fields, not by a new `risk` block.

## changePolicy — `ChangePolicy` (NO CHANGE)

Verbatim from `schema-and-resolution.md` 90–92:

```ts
type ChangePolicy = {
  allowedChangePaths: string[];
};
```

core-05 field path (frozen): `ResolvedPolicy.policy.changePolicy.allowedChangePaths`.

## merge — `MergePolicy` (NO TYPE CHANGE; path-naming ruling only)

Verbatim from `schema-and-resolution.md` 144–150:

```ts
type MergePolicy = {
  runnerMayPush: boolean;
  runnerMayOpenPr: boolean;
  runnerMayMerge: boolean;
  requiredEvidence: Array<"verification" | "ci" | "review" | "threads-resolved" | "protection">;
  mergeMethod?: "merge" | "squash" | "rebase";
};
```

core-05 field paths (frozen, reached via layer key `merge`):
- `ResolvedPolicy.policy.merge.runnerMayMerge`
- `ResolvedPolicy.policy.merge.runnerMayPush`
- `ResolvedPolicy.policy.merge.runnerMayOpenPr`
- `ResolvedPolicy.policy.merge.requiredEvidence`
- `ResolvedPolicy.policy.merge.mergeMethod`
