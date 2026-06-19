---
title: "Configuration & Policy — schema and resolution"
id: "fnd-01-schema-and-resolution"
layer: "foundation"
status: draft
last-reviewed: "2026-06-18"
---

# Schema & resolution

## Config shape

The config is a single project-local document with an explicit vNext marker. Unknown fields are
invalid unless the field is under an extension bag explicitly reserved by this schema.

```ts
type KitConfig = {
  schema: "kit-vnext.config.v1";
  project: {
    id: string;
    rootPolicy: "single-repo";
    tracks?: string[];
  };
  profiles?: Record<string, PolicyLayerPatch>;
};

type RunConfigInput = {
  profile?: string;
  overrides?: PolicyLayerPatch;
  run?: {
    taskId?: string;
    trackId?: string;
    dryRun?: boolean;
  };
};

type PolicyLayer = {
  run: RunPolicy;
  provisioning: ProvisioningPolicy;
  approval: ApprovalPolicy;
  escalationPolicy: EscalationPolicy;
  changePolicy: ChangePolicy;
  capabilities: CapabilityPolicy;
  merge: MergePolicy;
};
type PolicyLayerPatch = DeepPartial<PolicyLayer>;
```

The config has no project-authored `defaults` block. The defaults layer is an immutable built-in
`PolicyLayer` shipped with this schema version. Profiles and operator overrides are sparse patches.

## Policy blocks

```ts
type RunPolicy = {
  mode: "manual" | "assisted";
  maxConcurrentRuns: number;
  requireCleanWorkspace: boolean;
};

type ProvisioningPolicy = {
  ownershipClass: "owned" | "owned-remote" | "observe-only";
  containmentRequired: boolean;
  dependencyInstall: {
    defaultGrant: "none" | "narrow";
    allowedPrefixes: string[];
  };
};

type ApprovalPolicy = {
  mode: "manual" | "assisted";
  parkOnHumanLatency: boolean;
  requireRecordedDecision: boolean;
};

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

type ChangePolicy = {
  allowedChangePaths: string[];
};

type CapabilityPolicy = {
  "auto-merge": CapabilitySetting;
  "auto-recover": CapabilitySetting;
  "unattended-run": CapabilitySetting;
};
type CapabilitySetting = {
  desired: boolean;
  requireFreshAttestation: true;
};

type MergePolicy = {
  runnerMayPush: boolean;
  runnerMayOpenPr: boolean;
  runnerMayMerge: boolean;
  requiredEvidence: Array<"verification" | "ci" | "review" | "threads-resolved" | "protection">;
  mergeMethod?: "merge" | "squash" | "rebase";
};
```

## Safe defaults

The built-in defaults are complete and intentionally supervised:

- `run.mode = "assisted"`, `maxConcurrentRuns = 1`, `requireCleanWorkspace = true`.
- `approval.mode = "assisted"`, decisions must be recorded, and pending approvals park.
- `capabilities.*.desired = false`; every capability also requires fresh positive attestation.
- `provisioning.containmentRequired = true`; `ownershipClass = "owned"`.
- `provisioning.dependencyInstall.defaultGrant = "narrow"` with immutable built-in package-manager
  install prefixes. This grant is still bounded by `EscalationPolicy`.
- `escalationPolicy.denyByDefault = true`; default maximum scope is `per-command-prefix`.
- `changePolicy.allowedChangePaths = []`; no changed file path is allowed unless a profile or
  operator override grants it explicitly.
- `merge.runnerMayPush = true`, `runnerMayOpenPr = true`, `runnerMayMerge = false`; required
  evidence includes verification, CI, review, resolved threads, and protection.

No default silently enables an autonomous power. A capability is available only when both config
desires it and Capability & Safety has fresh positive attestations for the scoped provider guarantees.
`orchestrator-decide` is not in the v1 schema because AD-14 defers that capability. If any config,
profile, or override supplies it, validation fails with `unsupported_deferred_capability`.

## Deterministic precedence

Resolution inputs are exactly three layers: immutable built-in defaults, selected profile patch, and
operator per-run override patch. Operator override always wins.

Algorithm:

1. Validate `KitConfig.schema`; if absent or not `kit-vnext.config.v1`, return diagnostic/failure
   append intents and refuse to resolve policy.
2. Validate config and run input against the schema; reject unknown fields.
3. Select the profile if provided; unknown profile is a blocking error.
4. Load immutable built-in defaults for the schema version as a complete `PolicyLayer`.
5. Enumerate all leaf field paths in canonical lexicographic order.
6. For each leaf, choose the first defined value from operator override, profile patch, then built-in
   defaults.
7. Merge only object maps; arrays and scalar values replace atomically. `null` is invalid unless the
   field schema explicitly allows it.
8. Return one structural `ConfigFieldResolved` append intent per leaf in the same canonical order,
   followed by `ConfigResolved`.
9. The caller appends those intents through core-01's single RunWriter before treating
   `ResolvedPolicy` as active for the Run.

This makes the resolved policy a pure function of recorded inputs, schema version, and immutable
built-in defaults.

## Adoption diagnostics

Adoption detection is marker-first and fail-closed for both config and persisted artifacts:

```ts
type AdoptionSource = {
  config: ConfigSource;
  artifacts: ArtifactSource[];
};
type ArtifactSource = {
  path: string;
  class:
    | "run-event-log"
    | "projection"
    | "resolved-policy"
    | "capability-attestation"
    | "launch-artifact"
    | "unknown";
  marker?: string;
  contentHash: string;
};
```

Recognized artifact markers are `kit-vnext.event-log.v1`, `kit-vnext.projection.v1`,
`kit-vnext.resolved-policy.v1`, `kit-vnext.capability-attestation.v1`, and
`kit-vnext.launch.v1`. FND-01 diagnoses only configured vNext state locations supplied by the caller:
config, run event logs, projections, resolved-policy snapshots, capability-attestation artifacts, and
launch artifacts. Any artifact in those locations without a recognized marker, or with a known
non-vNext marker, returns an `AdoptionDiagnosticEmitted` append intent and blocks launch. The owning
core domain appends returned diagnostic/failure intents through core-01's single RunWriter. If those
intents cannot be recorded, launch remains blocked as `adoption_diagnostic_unrecorded`.
