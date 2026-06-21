---
title: "Frontier 2 charter - provider seams"
frontier: 2
status: draft
last-reviewed: "2026-06-20"
included-domains:
  - prov-03-work-source
  - prov-02-forge-collaboration
  - prov-04-execution-host
---

# Frontier 2 charter - provider seams

## Purpose

Frontier 2 implements the first provider seam contract + mock surfaces: Work Source, Forge, and
Execution Host. Each seam produces an SDK-owned port, neutral DTOs, testkit mocks, conformance
fixtures, degraded outcomes, and event-ready evidence payloads. Real drivers are separate
production-readiness stories that implement the same port but do not block core build/test work.

This charter does not define execution workflow. Provider seams expose facts and perform scoped
actions; control-plane domains decide what those facts mean.

## Included domains

| Domain | Role in this frontier | Primary spec surface |
|---|---|---|
| `prov-03` Work Source | Task/track intake, eligibility, race-safe claim/release, TaskSnapshot, status authority, Markdown and mock drivers. | `docs/design/30-domain-reference/providers/work-source/README.md` and `contracts-and-conformance.md`. |
| `prov-02` Forge / Collaboration | Remote credentialed collaboration, exact-head branch/PR/evidence/actions, GitHub and mock drivers. | `docs/design/30-domain-reference/providers/forge-collaboration/README.md` and `contracts-and-conformance.md`. |
| `prov-04` Execution Host | Workspace attachment, worker hosting, runner-owned commands, containment, termination, egress attestation, Local and mock drivers. | `docs/design/30-domain-reference/providers/execution-host/README.md` and `contracts-and-conformance.md`. |

## Why this frontier exists

Provider seams become implementable only after Frontier 0 substrate and Frontier 1 workspace, credential, and
run-event contracts exist. This frontier turns external-system interactions into typed, attested,
mockable seams while preserving the dependency rule: drivers implement contracts and may depend on the
SDK, but core logic does not depend on concrete providers.

Frontier 2 also carries the work-item lesson for all later story authoring: every story needs a
spec-surface manifest, falsifiable acceptance criteria, a failure/degraded outcome table, required
evidence, explicit boundaries, and STOP conditions.

## Dependencies and frozen inputs

- prov-03 consumes fnd-02 leases/artifacts and remains separate from core-01 run activity.
- prov-02 consumes fnd-04 credential/redaction/audit contracts and never exposes Forge credentials to
  workers.
- prov-04 consumes fnd-03 workspace attachments and fnd-04 injection/redaction/egress contracts.
- Package target maps real drivers to `provider-markdown`, `provider-github`, and `provider-local`,
  with provider interfaces and shared contract types in `sdk` and conformance helpers in `testkit`.
- Capability attestations are evidence records, not declarations. Missing, stale, negative, or
  wrong-scope attestations mean the capability is absent.
- Exact-head Forge reads/actions, Work Source/task-status authority, and Execution Host egress
  negative probes are fixed design constraints.

## Outputs

- Work Source contract + mock story: SDK `WorkSourceProvider` port, neutral `TaskSnapshot` and
  status-authority DTOs, mock driver, conformance fixtures, degraded tokens, and event-ready payloads.
- Work Source real-driver story: Markdown driver mapping, filesystem/track evidence, write
  conflict/race probes, and production capability attestations.
- Forge contract + mock story: SDK `ForgeProvider` port, exact-head DTOs, mock driver, conformance
  fixtures, degraded tokens, and event-ready payloads.
- Forge real-driver story: GitHub driver mapping, provider evidence refresh, protection/ruleset/merge
  queue probes, redaction, and production capability attestations.
- Execution Host contract + mock story: SDK `ExecutionHostProvider` port, workspace/worker/command
  capture DTOs, mock host, conformance fixtures, degraded tokens, and event-ready payloads.
- Execution Host real-driver story: Local driver process handling, termination/prove-empty,
  redaction, egress negative probes, and production capability attestations.
- Provider conformance suites and evidence fixtures proving real and mock drivers satisfy the same
  contract surfaces and degraded-mode tokens.
- Event-ready payloads and artifact refs for callers to append through core-01; provider domains do
  not author run truth directly.

## Scope boundaries

Frontier 2 must not define completion/merge decisions, approval policy, supervision timers, recovery
selection, task prioritization strategy, agent protocol, command sequencing, or edge operator UX. It
defines provider facts, action contracts, attestations, mocks, and driver conformance only.

STOP conditions for story authoring and implementation:

- A story lets a provider decide whether a run should complete, merge, recover, park, or escalate.
- A story writes core run activity directly instead of returning event-ready payloads and evidence.
- A story lets Work Source update run truth or lets core code edit task status outside Work Source.
- A story lets Forge act without exact `expectedHeadSha`, requires admin/bypass behavior, or exposes
  remote credentials to worker scope.
- A story lets Execution Host inspect local git, perform Forge actions, resolve secrets, or claim
  egress confinement without negative-probe evidence.
- A real driver cannot provide a required external proof and the story has no named degraded outcome.

## Per-domain responsibilities

### prov-03 Work Source

Responsibilities:

- Define the host-neutral Work Source contract for tracks, tasks, eligibility, claim/release, status
  writes, spec refs, dependencies, and capability attestations.
- Implement Markdown and mock driver behavior against the same contract and failure tokens.
- Produce a write-once `TaskSnapshot` artifact at claim time, including source digests, raw excerpt,
  inline/spec ref digests, dependency keys, claim metadata, and caller-provided source revision.
- Keep task status authority separate from run activity authority.

Acceptance conditions:

- Markdown and mock drivers both satisfy the same contract, preconditions, capability attestations,
  and conformance cases.
- Claim and status writes acquire the Track lease, reread, compare digests, edit only the task block,
  fsync, reread, and verify post-write digest.
- Missing dependencies, malformed tracks, unmapped statuses, claim races, unavailable locks, and
  snapshot failures return named degraded outcomes.
- Without `supportsClaim`, unattended task intake is unavailable; without `supportsStatusWrite`, the
  task cannot be marked complete; without `supportsDependencies`, dependent tasks are ineligible.
- Work Source never authors PRDs/designs, local git evidence, Forge state, or run event truth.

### prov-02 Forge / Collaboration

Responsibilities:

- Define the host-neutral Forge contract for remote credentialed collaboration.
- Implement GitHub and mock driver behavior for push, PR upsert/comment, evidence refresh,
  update-branch, enqueue, merge, and refusal/degraded outcomes.
- Bind every read and irreversible action to exact `expectedHeadSha`.
- Consume fnd-04 credential scopes, redaction sets, and audit event ids; reject worker scopes before
  resolving material.
- Attest rulesets, merge queue, thread resolution, and protection inspection from fresh provider
  evidence.

Acceptance conditions:

- A driver that cannot bind evidence/actions to PR head does not implement Forge.
- `updateBranch`, `enqueue`, and `merge` re-read head state and refuse on mismatch, missing, or
  unknown head.
- Protection, rulesets, merge queue, review threads, checks, auth, rate limits, and GHES/version gaps
  degrade with named tokens instead of empty or guessed evidence.
- Admin override, bypass, force-push, or ignoring rules is unreachable and returns
  `forge-admin-bypass-refused`.
- Provider responses are redacted before persistence and reference fnd-04 audit/redaction evidence.

### prov-04 Execution Host

Responsibilities:

- Define the host-neutral Execution Host contract for workspace attachment, worker hosting,
  observations, termination, runner-owned command capture, and workspace release.
- Implement Local and mock host conformance against the same field set and failure tokens.
- Apply fnd-04 injection plans without resolving secrets, enforce party/operation/policy binding, and
  redact captured output before persistence.
- Produce honest capability attestations for kill, containment strength, structured tool exits, and
  egress confinement.
- Prove termination by signal/grace/force-kill when needed, reap, and containment-empty evidence.

Acceptance conditions:

- `spawnWorker` and `runCommand` reject mismatched party, operation id, expired injection, wrong-scope
  egress policy, or missing matching attestation.
- `runCommand` captures argv, cwd, exit/signal, stdout/stderr refs, output digest, timing, and
  redaction status for runner-owned setup/verify/diagnostic commands.
- Worker observation captures redacted output, structured tool exits when available, process exit, and
  host failures without becoming Agent protocol logic.
- Egress confinement is positive only when disallowed-host negative probes are proven blocked for the
  matching policy digest, platform, driver version, scope, and freshness key.
- Incomplete command capture, unproven termination, host observation gaps, or credential destruction
  uncertainty returns named degraded outcomes.

## Evidence expectations

Every Frontier 2 story must include a spec-surface manifest naming the exact design sections,
provider-specific evidence appendix where applicable, package target, and mock/real conformance
surface it implements. Evidence must include:

- Contract tests shared by real and mock drivers for each provider seam.
- Failure/degraded outcome tests for every named token included in the story.
- Capability attestation tests for positive, negative, stale, wrong-scope, wrong-version, and missing
  evidence.
- Work Source fixtures for malformed markdown, duplicate ids, dependency gating, concurrent claim
  races, stale digests, expired claims, status write conflicts, and TaskSnapshot failure.
- Forge fixtures or recorded probes for exact-head mismatch, missing protection/rulesets/queue/thread
  evidence, auth denial, redaction, and admin/bypass refusal.
- Execution Host fixtures or probes for cwd containment, command capture, output digest stability,
  structured tool exits, termination/prove-empty, redaction, and egress negative-probe matching.

## Readiness criteria

Frontier 2 is implementation-ready when each story has:

- A spec-surface manifest tied to provider design files, evidence appendices where applicable, and
  package target docs.
- Falsifiable acceptance criteria for normal, failure, degraded, and boundary outcomes.
- A failure/degraded outcome table using approved provider tokens.
- Required evidence with exact real-driver, mock-driver, fixture, probe, and conformance
  expectations.
- Explicit boundaries and STOP conditions.
- No execution workflow, review-loop mechanics, PR handling, or session-process rules.

The frontier is implementation-ready for core when the three provider seams expose stable SDK
contracts, testkit mock/conformance surfaces, and event-ready evidence that later core domains can
consume without redefining task authority, Forge authority, host execution, capability attestations,
or degraded behavior. Real-driver stories remain tracked as production-readiness work and do not
block SDK/core build or mock-driven core tests.

## Expected story files to author next

Core-blocking contract+mock stories:

- `docs/implementation/frontiers/frontier-2-provider-seams/stories/prov-03-work-source-contract-and-mock.md`
- `docs/implementation/frontiers/frontier-2-provider-seams/stories/prov-02-forge-contract-and-mock.md`
- `docs/implementation/frontiers/frontier-2-provider-seams/stories/prov-04-execution-host-contract-and-mock.md`

Production-readiness real-driver stories:

- `docs/implementation/frontiers/frontier-2-provider-seams/stories/prov-03-markdown-driver-conformance.md`
- `docs/implementation/frontiers/frontier-2-provider-seams/stories/prov-02-github-driver-evidence-and-conformance.md`
- `docs/implementation/frontiers/frontier-2-provider-seams/stories/prov-04-local-driver-command-termination-and-egress.md`

## Deferred work

- Agent Execution provider and agent protocol.
- Capability & Safety gates, approval/escalation, supervision/liveness, completion/merge,
  recovery/reconciliation, observability, and edge surfaces.
- Auto-resolution of Forge review threads unless explicitly allowed by policy in a later contract.
- GHES/version support beyond attested GitHub driver capability.
- Future remote Execution Host protocol and stronger native containment choices beyond the v1 Local
  contract.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [implementation contract](../../README.md) · **← Prev:** [Frontier 1 charter - foundation dependents](../frontier-1-foundation-dependents/charter.md) · **Next →:** [Frontier 3 charter - agent and core gates](../frontier-3-agent-and-core-gates/charter.md)

<!-- /DOCS-NAV -->
