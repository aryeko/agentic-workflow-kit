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
  appendIntents: ConfigurationPolicyAppendIntent[];
};
type AdoptionContext = {
  eventWriter: DurableEventWriter;
};
type ResolvedPolicy = {
  schema: "kit-vnext.resolved-policy.v1";
  policy: PolicyLayer;
  provenance: Record<string, FieldProvenance>;
};
type ResolvedPolicyResult = {
  resolvedPolicy: ResolvedPolicy;
  appendIntents: NonEmptyArray<ConfigurationPolicyAppendIntent>;
};
type ConfigurationPolicyAppendIntent = {
  payload: ConfigFieldResolved | ConfigResolved | AdoptionDiagnosticEmitted | PolicyResolutionFailed;
  durability: "durable" | "barrier";
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
};
// Run-scoped config events (ConfigFieldResolved/ConfigResolved, carrying runId) are appended by
// core-01's single RunWriter; this domain RETURNS event-ready payloads rather than owning a writer.
// Pre-run ConfigLoaded (no runId, instance-scoped) is the only event this writer commits directly.
type DurableEventWriter = {
  appendConfigLoaded(event: ConfigLoaded): Result<{ transactionId: string }, "append_failed">;
};
type AdoptionDiagnosticFailure = {
  reason: "config_loaded_write_failed";
  blockingState: "config_loaded_unrecorded";
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
  appendIntents?: NonEmptyArray<ConfigurationPolicyAppendIntent>;
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
  ): Result<ResolvedPolicyResult, PolicyResolutionFailure>;
}
```

Consumed interfaces: none above Foundation. File loading and artifact discovery are supplied by lower
foundation mechanics. `DurableEventWriter` is injected foundation infrastructure only for committing
pre-run `ConfigLoaded`. Adoption and resolution return event-ready append intents for
`AdoptionDiagnosticEmitted`, `PolicyResolutionFailed`, `ConfigFieldResolved`, and `ConfigResolved`;
the owning core domain appends those payloads through core-01's single leased `RunWriter` before
binding the policy to a Run. If the caller cannot durably append the returned intents, no policy is
active for that Run and launch remains blocked.

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
- `adoption_diagnostic_unrecorded`: the caller could not append the returned diagnostic/failure
  intents through core-01; launch remains blocked.
- `config_loaded_unrecorded`: pre-run `ConfigLoaded` could not be committed; launch remains blocked.
- `config_invalid`: schema validation failed. No policy is returned.
- `profile_unknown`: requested profile does not exist. No fallback profile is selected.
- `override_invalid`: operator override has an unknown or invalid field. No partial override applies.
- `unsupported_deferred_capability`: config attempts to set `orchestrator-decide` in v1.
- `provenance_write_failed`: policy was computed but not activated because the caller could not append
  the returned provenance events through core-01.

Capability gates treat any missing resolved policy, failed diagnostic, or missing provenance event as
all autonomous capabilities absent. The safe degraded state is supervised, blocked before launch.

## Testing strategy

- Schema tests validate good configs, reject unknown fields, and snapshot safe defaults.
- Property tests generate built-in defaults/profile/operator patches and prove operator override wins
  for every field, independent of object insertion order.
- Provenance tests assert one returned event-ready payload per leaf field, canonical ordering, correct
  source layer, and stable value hashes.
- Append-failure tests live with the core-01 RunWriter integration: if the returned intent batch cannot
  be committed, no policy becomes active for the Run and launch remains blocked.
- Adoption tests cover valid vNext markers, incompatible config markers, absent config markers,
  recognized artifact markers, absent artifact markers, incompatible artifact markers, unknown
  artifacts in configured state locations, and returned diagnostic/failure append intents.
- Capability default-off tests prove no config default enables autonomy and all enabled desires still
  require fresh positive attestation.
- Deferred-capability tests prove `orchestrator-decide` is rejected in config, profile, and override.
- NFR-TEST is met with pure functions and in-memory event sinks; no real providers, credentials,
  processes, or Forge operations are used.
