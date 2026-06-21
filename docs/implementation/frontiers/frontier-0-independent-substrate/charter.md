---
title: "Frontier 0 charter - independent substrate"
frontier: 0
status: draft
last-reviewed: "2026-06-20"
included-domains:
  - fnd-01-configuration-and-policy
  - fnd-02-storage-and-artifacts
---

# Frontier 0 charter - independent substrate

## Purpose

Frontier 0 establishes the implementation substrate that every later domain depends on: deterministic
configuration and policy resolution, adoption diagnostics, durable event-log storage, leased
coordination, and write-once artifacts. It is an implementation contract for what the frontier must
deliver, not an execution plan.

## Included domains

| Domain | Role in this frontier | Primary spec surface |
|---|---|---|
| `fnd-01` Configuration & Policy | Defines resolved policy, provenance, safe defaults, and fail-closed adoption diagnostics. | `docs/design/30-domain-reference/foundation/configuration-and-policy/README.md` plus sibling schema and verification files. |
| `fnd-02` Storage & Artifacts | Defines physical durability, leases, artifact refs, storage health, and degraded-mode behavior. | `docs/design/30-domain-reference/foundation/storage-and-artifacts/README.md`. |

## Why this frontier exists

These domains have no dependencies above Foundation and are prerequisites for trustworthy later work.
Later domains may only rely on active policy after fnd-01 returns resolved policy plus provenance
append intents, and may only treat run facts, coordination, and evidence as durable after fnd-02
proves append, lease, and artifact guarantees.

The frontier is intentionally narrow: it produces reusable substrate contracts and conformance
evidence, not run orchestration, provider behavior, approval rules, or merge/completion decisions.

## Dependencies and frozen inputs

- Domain source of truth is `docs/design/30-domain-reference/**` for the included domains.
- Package target is `docs/design/20-sdk-and-packaging/package-target.md`; the implementation surface
  belongs in the SDK/testkit substrate, not in per-domain packages.
- fnd-01 depends on no higher layer and must not import core, provider, driver, or edge behavior.
- fnd-02 depends on no higher layer and treats event payloads as opaque bytes.
- Accepted config marker is `kit-vnext.config.v1`; unknown fields and deferred autonomous powers fail
  closed.
- fnd-02 `ArtifactRef.id` is the canonical opaque artifact reference string consumed by later domains.

## Outputs

- Configuration schema and validation for project config, profile patches, run overrides, policy
  blocks, credential-reference source fields, and egress-policy source fields.
- Deterministic resolution from built-in defaults, selected profile, and operator override, including
  per-field provenance and stable value hashes.
- Adoption diagnostics for incompatible or unknown config/artifact markers, with blocking failure
  states and guidance references.
- Storage contracts for event-log append/replay, durability classes, leases with epoch fencing, and
  immutable artifact storage with redaction/tombstone metadata.
- Storage health and degraded-mode outputs that later gates can treat as absent capability.
- Testkit fixtures and conformance helpers for policy resolution, adoption diagnostics, append/replay,
  lease fencing, artifacts, redaction hooks, and fault injection.

## Scope boundaries

Frontier 0 must not define or implement run lifecycle state, execution workflow, Work Source claims,
Forge actions, workspace creation, credential injection, or completion/merge policy. It may expose
typed outputs that later domains consume, but it must not apply those later-domain decisions.

STOP conditions for story authoring and implementation:

- A story requires interpreting provider, core, or edge behavior instead of returning substrate data.
- A story stores secret material or provider credentials in config, logs, artifacts, or fixtures.
- A story lets an invalid config, unknown artifact marker, stale lease, corrupt log, or degraded
  storage root proceed as success.
- A story uses fnd-02 scratch artifacts as gate evidence or exportable authoritative evidence.

## Per-domain responsibilities

### fnd-01 Configuration & Policy

Responsibilities:

- Validate the config schema and reject unknown or deferred fields.
- Provide complete safe built-in defaults: assisted/manual operation, capabilities off, default-deny
  egress, no credential refs, and no implicit autonomous powers.
- Resolve policy deterministically with operator override winning over profile and defaults.
- Return one event-ready provenance append intent per resolved leaf field, followed by the resolved
  policy fact.
- Diagnose incompatible or unknown adoption inputs and refuse launch with explicit blocking states.

Acceptance conditions:

- Given the same config, selected profile, run override, schema version, and built-in defaults,
  resolution returns identical policy, ordering, hashes, and append intents.
- For every generated field conflict, operator override wins; absent override falls back to profile,
  then built-in defaults.
- Invalid markers, unknown fields, unknown profiles, invalid overrides, and `orchestrator-decide`
  return named failures without partial active policy.
- Credential and egress source fields are validated and provenance-recorded but never resolve secret
  material or enforce egress.

### fnd-02 Storage & Artifacts

Responsibilities:

- Provide framed append-only log persistence with `durable` and `barrier` receipts and explicit
  handling for `buffered` non-authoritative writes.
- Enforce single-writer safety through named leases, monotonic epochs, opaque tokens, and stale-writer
  fencing.
- Provide immutable artifact storage with digest addressing, stable refs, redaction hooks, retention
  metadata, tombstones, and export manifests.
- Distinguish tail repair from interior corruption and network/filesystem degraded modes.

Acceptance conditions:

- Stale or missing lease capabilities cannot append, renew, release, or clean up protected state.
- Replay after successful appends is deterministic, with contiguous sequences and verified frame
  digests.
- Tail corruption is quarantined and repairable to the last committed frame; interior corruption
  makes the log read-only/unavailable for authoritative append.
- Artifact writes are immutable and digest-verified; redacted replacements and tombstones preserve
  auditability without rewriting raw blobs.
- Degraded storage refuses authoritative logs, leases, evidence refs, and exports.

## Evidence expectations

Every Frontier 0 story must include a spec-surface manifest naming the exact design sections and package
target surface it implements. Evidence must be external to prose assertions and should include:

- Passing unit/property tests for deterministic policy resolution and stable provenance ordering.
- Negative tests for each fnd-01 failure token and adoption diagnostic path.
- Fault-injection tests for append, fsync, rename, guarded lease update, partial write, and replay.
- Conformance fixtures for artifact immutability, digest verification, redaction tombstones, scratch
  refs, and export refusal when verification fails.
- Boundary tests showing no imports or public types from core, providers, drivers, or edge.

## Readiness criteria

Frontier 0 is implementation-ready when each story has:

- A spec-surface manifest tied to fnd-01/fnd-02 design files and package target.
- Falsifiable acceptance criteria for success, degraded, and failure outcomes.
- A failure/degraded outcome table using the named failure tokens from the domain designs.
- Required evidence describing exact test suites, fixtures, and conformance data.
- Explicit boundaries and STOP conditions.
- No execution workflow, review-loop mechanics, PR handling, or session-process rules.

The frontier is complete only when fnd-01 and fnd-02 outputs are stable enough for Frontier 1 stories to
consume without redefining config, provenance, leases, logs, artifact refs, or degraded-mode tokens.

## Expected story files to author next

- `docs/implementation/frontiers/frontier-0-independent-substrate/stories/fnd-01-config-schema-and-resolution.md`
- `docs/implementation/frontiers/frontier-0-independent-substrate/stories/fnd-01-adoption-diagnostics-and-provenance.md`
- `docs/implementation/frontiers/frontier-0-independent-substrate/stories/fnd-02-event-log-and-lease-primitives.md`
- `docs/implementation/frontiers/frontier-0-independent-substrate/stories/fnd-02-artifact-store-and-storage-health.md`

## Deferred work

- Core-01 event semantics, lifecycle transitions, projections, and run writer ownership.
- Workspace lifecycle, local git evidence, and declared setup execution.
- Credential resolution, scoped injection, redaction audit, and egress attestation.
- Work Source, Forge, Execution Host, Agent, and Edge provider/driver behavior.
- SQLite or remote storage backends beyond the fnd-02 contract.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [implementation contract](../../README.md) · **← Prev:** [implementation readiness matrix](../../readiness-matrix.md) · **Next →:** [Frontier 1 charter - foundation dependents](../frontier-1-foundation-dependents/charter.md)

<!-- /DOCS-NAV -->
