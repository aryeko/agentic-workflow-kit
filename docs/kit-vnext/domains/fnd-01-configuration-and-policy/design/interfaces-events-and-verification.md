---
title: "Configuration & Policy — interfaces, events, and verification"
id: "fnd-01-interfaces-events-and-verification"
layer: "foundation"
status: draft
last-reviewed: "2026-06-18"
---

# Interfaces, events & verification

## Exposed interface

```ts
type ConfigSource = { path: string; content: string };
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
type AdoptionReport = {
  diagnostics: AdoptionDiagnostic[];
  mayLaunch: boolean;
};
type AdoptionContext = {
  eventWriter: DurableEventWriter;
};
type ResolvedPolicy = {
  schema: "kit-vnext.resolved-policy.v1";
  policy: PolicyLayer;
  provenance: Record<string, FieldProvenance>;
};
type FieldProvenance = {
  fieldPath: string;
  sourceLayer: "operator-override" | "profile" | "built-in-defaults";
  profile?: string;
  sourceRef: string;
  valueHash: string;
};
type AdoptionDiagnostic = {
  state: "adoption_incompatible" | "adoption_unknown_artifact";
  path: string;
  observedMarker?: string;
  reason: string;
  guidanceRef: string;
};
type ResolutionContext = {
  runId: string;
  eventWriter: DurableEventWriter;
};
type DurableEventWriter = {
  appendConfigurationEvents(
    events: NonEmptyArray<ConfigurationPolicyEvent>,
  ): Result<{ transactionId: string }, "append_failed">;
};
type AdoptionDiagnosticFailure = {
  reason: "diagnostic_write_failed";
  blockingState: "adoption_diagnostic_unrecorded";
};
type PolicyResolutionFailure = {
  reason:
    | "adoption_incompatible"
    | "adoption_unknown_artifact"
    | "config_invalid"
    | "profile_unknown"
    | "override_invalid"
    | "unsupported_deferred_capability"
    | "provenance_write_failed";
  blockingState: string;
  diagnostic?: AdoptionDiagnostic;
};

interface ConfigurationPolicy {
  diagnoseAdoption(
    sources: AdoptionSource,
    context: AdoptionContext,
  ): Result<AdoptionReport, AdoptionDiagnosticFailure>;
  resolveRunPolicy(
    source: ConfigSource,
    input: RunConfigInput,
    context: ResolutionContext,
  ): Result<ResolvedPolicy, PolicyResolutionFailure>;
}
```

Consumed interfaces: none above Foundation. File loading and artifact discovery are supplied by lower
foundation mechanics. `DurableEventWriter` is injected foundation infrastructure; it must atomically
commit the complete diagnostic or resolution event batch, or report `append_failed`. `ResolvedPolicy`
is returned only after the resolution commit succeeds. If the failure event cannot be appended, the
function still returns `provenance_write_failed` and no policy.

## Events

```ts
type ConfigLoaded = {
  configRef: string;
  schema: "kit-vnext.config.v1";
  contentHash: string;
  at: string;
};

type ConfigFieldResolved = {
  runId: string;
  fieldPath: string;
  sourceLayer: "operator-override" | "profile" | "built-in-defaults";
  profile?: string;
  sourceRef: string;
  valueHash: string;
  at: string;
};

type ConfigResolved = {
  runId: string;
  resolvedPolicyHash: string;
  fieldCount: number;
  at: string;
};

type AdoptionDiagnosticEmitted = {
  diagnostic: AdoptionDiagnostic;
  at: string;
};

type PolicyResolutionFailed = {
  reason:
    | "adoption_incompatible"
    | "adoption_unknown_artifact"
    | "config_invalid"
    | "profile_unknown"
    | "override_invalid"
    | "unsupported_deferred_capability"
    | "provenance_write_failed";
  blockingState: string;
  at: string;
};
type ConfigurationPolicyEvent =
  | ConfigLoaded
  | ConfigFieldResolved
  | ConfigResolved
  | AdoptionDiagnosticEmitted
  | PolicyResolutionFailed;
```

## Failure modes

- `adoption_incompatible`: config has a non-vNext marker. Refuse to run with guidance.
- `adoption_unknown_artifact`: config or artifact has no recognized vNext marker. Refuse to run.
- `adoption_diagnostic_unrecorded`: adoption diagnostics could not be durably recorded.
- `config_invalid`: schema validation failed. No policy is returned.
- `profile_unknown`: requested profile does not exist. No fallback profile is selected.
- `override_invalid`: operator override has an unknown or invalid field. No partial override applies.
- `unsupported_deferred_capability`: config attempts to set `orchestrator-decide` in v1.
- `provenance_write_failed`: policy was computed but not returned because provenance was not durable.

Capability gates treat any missing resolved policy, failed diagnostic, or missing provenance event as
all autonomous capabilities absent. The safe degraded state is supervised, blocked before launch.

## Testing strategy

- Schema tests validate good configs, reject unknown fields, and snapshot safe defaults.
- Property tests generate built-in defaults/profile/operator patches and prove operator override wins
  for every field, independent of object insertion order.
- Provenance tests assert one event per leaf field, canonical ordering, correct source layer, and
  stable value hashes.
- Append-failure tests assert `resolveRunPolicy` returns no policy unless the complete event batch is
  committed, and returns `provenance_write_failed` on writer failure.
- Adoption tests cover valid vNext markers, incompatible config markers, absent config markers,
  recognized artifact markers, absent artifact markers, incompatible artifact markers, unknown
  artifacts in configured state locations, and diagnostic append failure.
- Capability default-off tests prove no config default enables autonomy and all enabled desires still
  require fresh positive attestation.
- Deferred-capability tests prove `orchestrator-decide` is rejected in config, profile, and override.
- NFR-TEST is met with pure functions and in-memory event sinks; no real providers, credentials,
  processes, or Forge operations are used.
