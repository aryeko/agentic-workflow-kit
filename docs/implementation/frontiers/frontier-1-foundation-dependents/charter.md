---
title: "Frontier 1 charter - foundation dependents"
frontier: 1
status: draft
last-reviewed: "2026-06-20"
included-domains:
  - fnd-03-workspace-and-repository
  - fnd-04-credentials-and-secrets
  - core-01-run-lifecycle-and-state
---

# Frontier 1 charter - foundation dependents

## Purpose

Frontier 1 turns the independent substrate into the first usable control-plane contracts: local
workspace/repository preparation, credential and egress-policy handling, and the run event-log spine.
It defines what implementation must deliver at this frontier, without defining execution workflow.

## Included domains

| Domain | Role in this frontier | Primary spec surface |
|---|---|---|
| `fnd-03` Workspace & Repository | Local worktree lease, branch creation, setup declaration, local git evidence, and cleanup. | `docs/design/30-domain-reference/foundation/workspace-and-repository/README.md`. |
| `fnd-04` Credentials & Secrets | Scoped credential model, injection planning, redaction, audit payloads, and egress policy. | `docs/design/30-domain-reference/foundation/credentials-and-secrets/README.md` and `contracts-and-events.md`. |
| `core-01` Run Lifecycle & Event State | Run event envelope, single leased writer, lifecycle state machine, session linkage, and projections. | `docs/design/30-domain-reference/core/run-lifecycle-and-state/**`. |

## Why this frontier exists

These domains are the first dependents on Frontier 0. They can consume resolved policy, leases, event-log
storage, artifact refs, and storage health, but they must remain below provider mechanics and above no
driver-specific behavior. The frontier exists to make later provider seams and core gates testable
against stable workspace, credential, and run-state facts.

## Dependencies and frozen inputs

- fnd-03 consumes fnd-01 repository/setup/cleanup policy and fnd-02 leases/artifacts.
- fnd-04 consumes fnd-01 credential references and egress source policy, and produces validated
  credential, redaction, and egress-policy contracts.
- core-01 consumes fnd-01 resolved policy data and fnd-02 lease/log/artifact primitives.
- Package target remains SDK-centered: these contracts belong in SDK runtime/internal modules and
  testkit fixtures unless a later provider package explicitly implements a driver.
- The worker/runner boundary is fixed: workers never receive Forge credentials.
- The two authorities are fixed: Work Source owns task status, while core-01 owns run activity.

## Outputs

- Local-only workspace contract for resolving repository identity, creating leased worktrees,
  creating local branches, evaluating/confirming setup freshness, recording local git evidence, and
  fenced cleanup.
- Credential contract for resolving references at use time, planning party/phase-scoped injection,
  producing redaction sets, issuing egress policies, auditing credential use, and denying unsafe use.
- Run event-log contract for event envelopes, append intents, leased writer discipline, lifecycle
  transitions, append-only session linkage, replay, wait cursors, and pure projections.
- Shared evidence references linking workspace evidence, credential audit facts, and run envelopes by
  opaque artifact ids and event refs.
- Testkit fixtures proving boundary constraints and fail-closed behavior without real providers,
  network, credentials, Forge, or worker processes.

## Scope boundaries

Frontier 1 must not define Work Source claiming/status mechanics, Forge push/PR/check/merge behavior,
Execution Host process spawning, Agent protocol, completion/merge decisions, supervision timers, or
operator entry surfaces. It may expose the facts those later domains require.

STOP conditions for story authoring and implementation:

- A story introduces remote refs, remotes, hosted repository ids, CI/checks, PRs, pushes, merges, or
  provider credentials into fnd-03.
- A story exposes Forge credentials to worker scopes or stores secret material in durable state.
- A story allows core-01 projections to be authored directly, or lets any event other than
  `RunLifecycleTransitioned` author lifecycle state.
- A story treats Work Source task status or provider state as run truth.
- A story relies on live filesystem/network/provider state during core-01 replay or projection.

## Per-domain responsibilities

### fnd-03 Workspace & Repository

Responsibilities:

- Own only local git worktree lifecycle and local git evidence.
- Create fenced worktree leases backed by fnd-02 and freeze base SHA, branch name, worktree path,
  epoch, and token for later use.
- Represent declared setup and freshness evaluation, while leaving execution to Execution Host.
- Record read-only local git evidence: branch, base/head, merge base, commits, diff artifacts, and
  working-tree state.
- Clean up leased worktrees and local branches only under fenced, evidence-bound conditions.

Acceptance conditions:

- Public types contain no remote URL, upstream ref, credential, CI, PR, review, check, merge, process,
  or command-execution capability.
- Missing base refs fail without fetch; branch/path conflicts fail without overwriting unrelated
  state.
- Setup can become `ready` only after the same freshness detector confirms it.
- Local git evidence is all-or-nothing; missing branch, merge base, status, or diff returns a named
  unavailable outcome.
- Cleanup is unsettled until path, registration, branch decision, and tombstone are all resolved.

### fnd-04 Credentials & Secrets

Responsibilities:

- Convert fnd-01 credential and egress source fields into validated `CredentialRef` and
  `EgressPolicy` contracts.
- Resolve secret material only at use time and keep it memory-only or in temporary injected files
  outside repo-controlled paths.
- Enforce party, phase, host, command-prefix, TTL, grant, redaction, and egress-attestation
  constraints before any credential use.
- Produce credential audit payloads and redaction events without reversible secret values.
- Deny worker access to Forge credentials under every policy or grant shape.

Acceptance conditions:

- A pure predicate proves `scope.party === "worker"` can never receive `kind: "forge"`.
- Every credential use has exactly one started or denied audit fact, and every started use settles
  with finished and destroyed facts or a degraded outcome.
- Missing, stale, partial, or wrong-scope egress attestation denies confined credentials.
- Redaction covers structured data, logs, provider responses, process output, command lines, errors,
  prompts/tool results, and text artifacts before persistence.
- Binary or unredactable artifacts are quarantined and cannot satisfy gates.

### core-01 Run Lifecycle & Event State

Responsibilities:

- Own the run event envelope, append protocol, leased writer, sequence discipline, and lifecycle
  state machine.
- Author run state only through committed event envelopes; projections are pure replay outputs.
- Map lifecycle changes only through `RunLifecycleTransitioned`, with factual events cited as source
  evidence.
- Preserve append-only session linkage and deterministic projection rebuild.
- Reject stale writer epochs, illegal lifecycle transitions, insufficient durability, malformed
  envelopes, corrupt logs, and unavailable logs.

Acceptance conditions:

- Replaying the same committed log yields identical `state`, `summary`, `metrics`, and `launch`
  projections.
- `RunCreated`, `RunPolicyBound`, `TaskSnapshotRecorded`, and `SessionLinked` do not move lifecycle
  state unless referenced by `RunLifecycleTransitioned`.
- All lifecycle transitions outside the legal table fail, including recovery transitions that do not
  cite recovery evidence.
- Canonical run events never use fnd-02 `buffered` durability.
- Well-formed unknown future payloads are preserved and do not break replay unless core-01 declares
  them projection-relevant.

## Evidence expectations

Every Frontier 1 story must include a spec-surface manifest naming the exact design files and package
target surface it implements. Evidence must include:

- Boundary tests proving fnd-03 remains local-git-only and fnd-04 never exposes worker Forge
  credentials.
- Fixture tests for worktree lease lifecycle, setup freshness, local git evidence, cleanup blocked
  states, and path containment.
- Credential property tests, redaction coverage tests, egress-attestation denial tests, and audit
  settlement tests.
- Core-01 property tests for append/replay/projection determinism, lifecycle table completeness,
  stale-writer fencing, lost acknowledgement, session linkage, and projection purity.
- Failure/degraded outcome tests for every named failure token used in each story.

## Readiness criteria

Frontier 1 is implementation-ready when each story has:

- A spec-surface manifest tied to fnd-03, fnd-04, core-01, and package target docs.
- Falsifiable acceptance criteria for normal, failure, degraded, and boundary outcomes.
- A failure/degraded outcome table using approved domain tokens.
- Required evidence with exact fixture/conformance/property-test expectations.
- Explicit boundaries and STOP conditions.
- No execution workflow, review-loop mechanics, PR handling, or session-process rules.

The frontier is complete only when later provider seams can consume stable workspace attachments,
credential/egress contracts, and run event/projection contracts without redefining local git,
credential, redaction, event-envelope, writer, or lifecycle semantics.

## Expected story files to author next

- `docs/implementation/frontiers/frontier-1-foundation-dependents/stories/fnd-03-worktree-lifecycle-and-local-git-evidence.md`
- `docs/implementation/frontiers/frontier-1-foundation-dependents/stories/fnd-03-setup-and-cleanup-boundaries.md`
- `docs/implementation/frontiers/frontier-1-foundation-dependents/stories/fnd-04-credential-scope-redaction-and-audit.md`
- `docs/implementation/frontiers/frontier-1-foundation-dependents/stories/fnd-04-egress-policy-and-attestation-handoff.md`
- `docs/implementation/frontiers/frontier-1-foundation-dependents/stories/core-01-run-event-envelope-and-writer.md`
- `docs/implementation/frontiers/frontier-1-foundation-dependents/stories/core-01-projections-lifecycle-and-session-linkage.md`

## Deferred work

- Work Source task enumeration, claims, status writes, and Markdown/mock drivers.
- Forge push, PR, review, check, ruleset, queue, and merge behavior.
- Execution Host worker spawn, runner command capture, termination, and egress probing.
- Agent protocol, supervision, approval, completion, recovery, observability, and edge surfaces.
- Real secret-manager integrations beyond the fnd-04 contract.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [implementation contract](../../README.md) · **← Prev:** [Frontier 0 charter - independent substrate](../frontier-0-independent-substrate/charter.md) · **Next →:** [Frontier 2 charter - provider seams](../frontier-2-provider-seams/charter.md)

<!-- /DOCS-NAV -->
