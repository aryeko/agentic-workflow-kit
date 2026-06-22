---
title: Epic 1 - Foundation substrate
epic: 1
status: "epic: frozen"
depends-on-epics: [0]
last-reviewed: "2026-06-22"
---

# Epic 1 - Foundation Substrate

## Purpose

Epic 1 gives the SDK its deterministic root substrate: resolved configuration and policy, durable
storage and artifact references, local workspace and repository evidence, and credential, redaction,
and egress-policy contracts.

## Included domains

| Domain | Role in this epic | Primary spec surface |
|---|---|---|
| `fnd-01` Configuration & Policy | Provides deterministic policy resolution and consumer policy shapes. | vNext config schema, precedence, provenance, diagnostics, and policy-shape contracts. |
| `fnd-02` Storage & Artifacts | Provides the durable storage, lease, artifact, and evidence-reference substrate. | Event-log persistence, leases, artifact refs, health, filesystem behavior, and evidence bundles. |
| `fnd-03` Workspace & Repository | Provides local-only repository and worktree evidence contracts. | Worktree leases, local git evidence, branch model, setup metadata, and cleanup records. |
| `fnd-04` Credentials & Secrets | Provides secret isolation, scoped injection planning, redaction, audit, and egress policy. | Credential refs, scoped grants, redaction sets, audit records, egress policy, and failure modes. |

## Why this epic exists

Provider ports, core gates, completion decisions, concrete drivers, and operator composition all need
safe foundation shapes before they can be authored. Epic 1 closes those root contracts without
deciding provider behavior or core runtime semantics.

The hard dependency edge is owned by `epic-dag.md`: Epic 1 depends on Epic 0, Epic 2 and Epic 3 consume
Epic 1, and Epic 6 can proceed against these foundation contracts once Epic 2 provider contracts are
stable.

## Frozen inputs

- Epic 0 package graph, dependency guardrails, TypeScript references, and local check gate.
- `docs/implementation/domains/foundation/fnd-01-configuration-and-policy.md`.
- `docs/implementation/domains/foundation/fnd-02-storage-and-artifacts.md`.
- `docs/implementation/domains/foundation/fnd-03-workspace-and-repository.md`.
- `docs/implementation/domains/foundation/fnd-04-credentials-and-secrets.md`.
- `docs/implementation/epic-dag.md` direct dependency table.

## Outputs

- SDK configuration and policy-resolution surface with vNext marker validation, precedence,
  provenance, diagnostics, and consumer policy shapes.
- Storage, artifact, lease, and evidence-bundle contract surface, including in-memory defaults,
  filesystem-backed behavior, and conformance fixtures.
- Local workspace and repository contract surface for worktree leasing, setup metadata, local git
  evidence, and cleanup settlement.
- Credential, redaction, audit, scoped injection, and egress-policy contract surface that keeps Forge
  credentials runner-owned.
- Foundation evidence showing later epics can consume these surfaces through SDK contracts rather than
  private shapes.

## Scope boundaries

- In: foundation contract surfaces, foundation defaults, local-only evidence, storage and lease
  primitives, redaction and egress-policy documents, and foundation conformance fixtures.
- Out: provider behavior, concrete drivers, event semantics above persistence, approval decisions,
  capability predicates, completion predicates, recovery decisions, remote Forge operations, and
  operator UX.
- STOP when: a story needs provider-specific behavior, core lifecycle semantics, a concrete driver
  decision, or any credential flow that would expose runner-only Forge credentials to a worker.

## Per-domain expectations

For each included domain, the table lists the `Story Group Signals` this epic claims. Story ownership
is backfilled from the Epic 1 story DAG for independent review.

### `fnd-01` - Configuration & Policy

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| Config schema and accepted vNext marker. | `fnd-01-s1-config-schema` | covered |
| Deterministic precedence across defaults, profile, and operator override. | `fnd-01-s2-policy-resolution` | covered |
| Per-field provenance and policy-resolution event payloads. | `fnd-01-s2-policy-resolution` | covered |
| Safe defaults, default-off capabilities, and deferred autonomy rejection. | `fnd-01-s1-config-schema` | covered |
| Adoption diagnostics for legacy, unknown, or incompatible config and artifacts. | `fnd-01-s3-adoption-diagnostics` | covered |
| Consumer policy shapes for capability, approval, escalation, merge, credential refs, and egress. | `fnd-01-s1-config-schema` | covered |

- Evidence expectation: Epic 1 stories leave checkable SDK policy contracts and diagnostic evidence
  that later epics can consume without re-deciding policy precedence or defaults.

### `fnd-02` - Storage & Artifacts

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| Event-log persistence, durability classes, append receipts, and replay health. | `fnd-02-s2-event-log` | covered |
| Lease acquisition, renewal, release, and epoch fencing. | `fnd-02-s3-lease-store` | covered |
| Artifact refs, scratch refs, digest metadata, redaction hooks, tombstones, and export manifests. | `fnd-02-s4-artifact-evidence` | covered |
| Storage health and fail-closed degraded modes. | `fnd-02-s1-storage-health` | covered |
| Filesystem-backed storage behavior and conformance fixtures. | `fnd-02-s5-filesystem-conformance` | covered |
| Evidence bundles that preserve stable refs, digests, and redacted-by-default exports. | `fnd-02-s4-artifact-evidence` | covered |

- Evidence expectation: Epic 1 stories prove storage, lease, artifact, and evidence-reference surfaces
  are durable enough for later run-state, recovery, provider-evidence, and operator-export consumers.

### `fnd-03` - Workspace & Repository

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| Repository identity and local-only branch model. | `fnd-03-s1-repository-branch` | covered |
| Worktree lease lifecycle and cleanup state. | `fnd-03-s2-worktree-setup` | covered |
| Declared setup metadata and freshness evaluation handoff. | `fnd-03-s2-worktree-setup` | covered |
| Local git evidence for branch existence, commits, base/head SHAs, merge base, diff, and working tree state. | `fnd-03-s3-local-git-evidence` | covered |
| Boundary checks proving no remote, credential, process, CI, PR, check, review, or merge fields. | `fnd-03-s1-repository-branch` | covered |
| Cleanup tombstones, blocked cleanup records, and missing or moved worktree settlement. | `fnd-03-s4-cleanup-settlement` | covered |

- Evidence expectation: Epic 1 stories leave local repository evidence and cleanup records that
  completion, recovery, and concrete providers can consume without remote or process authority.

### `fnd-04` - Credentials & Secrets

| Story Group Signal (from charter) | Owning story | Disposition |
|---|---|---|
| Credential references, scopes, allowed parties, phases, hosts, TTL, and policy digests. | `fnd-04-s1-credential-refs` | covered |
| Injection plans that distinguish runner-only Forge credentials from worker-safe grants. | `fnd-04-s2-injection-egress` | covered |
| Redaction sets for telemetry, process output, provider responses, and artifacts. | `fnd-04-s3-redaction` | covered |
| Credential audit events, tamper-evidence fields, finish and destroy records, and denial records. | `fnd-04-s4-audit-failures` | covered |
| Egress policy issuance and matching attestation evidence before confined credential release. | `fnd-04-s2-injection-egress` | covered |
| Failure modes for unresolved refs, denied scopes, worker Forge exposure, missing audit, failed redaction, missing egress attestation, and unconfirmed destruction. | `fnd-04-s4-audit-failures` | covered |

- Evidence expectation: Epic 1 stories prove secret references, redaction, audit, and egress-policy
  contracts are available before provider ports, grants, or concrete credentialed drivers consume them.

## Epic readiness

- Epic 2 can author provider ports, mocks, and conformance helpers against stable foundation policy,
  artifact, workspace, and credential vocabulary.
- Epic 3 can author run lifecycle, capability gates, and analysis against durable storage and resolved
  policy surfaces.
- Epic 5 can later consume local git evidence, leases, evidence refs, policy snapshots, and credential
  audit records without redefining Foundation.
- Epic 6 can implement concrete drivers using stable workspace, artifact, credential, redaction, and
  egress-policy contracts.

## Deferred work

- Provider SDK ports, mocks, conformance helpers, and concrete drivers are deferred to Epic 2 and
  Epic 6.
- Core event semantics, capability records, approval decisions, liveness, completion, and recovery are
  deferred to Epic 3 through Epic 5.
- CLI, MCP, production composition, and operator rendering are deferred to Epic 7.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [epic charters](../README.md) · **← Prev:** [Epic 0 - story DAG](../epic-0-implementation-substrate-and-guardrails/story-dag.md) · **Next →:** [Epic 1 - stories](./stories/README.md)

**Children:** [Epic 1 - stories](./stories/README.md) · [Epic 1 - story DAG](./story-dag.md)

<!-- /DOCS-NAV -->
