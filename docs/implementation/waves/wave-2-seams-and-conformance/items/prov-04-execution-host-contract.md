---
title: "prov-04 — Execution Host contract + mock — implementation charter"
id: "prov-04-contract"
wave: 2
layer: "contracts (providers)"
status: "item: ready"
spec: "docs/design/domains/providers/prov-04-execution-host/ (README.md + contracts-and-conformance.md)"
---

# prov-04 — Execution Host contract + mock

**Purpose.** The host-neutral contract for **where and how processes run** — spawn + contain a worker,
terminate the whole tree, run runner-owned commands (the verifier), attest egress confinement — plus a
mock host. **Contract + mock only; the real Local driver and its native containment helper are the
driver track.** (FR-3/FR-5/FR-6, NFR-SEC, AD-2, AD-13.)

**Spec (normative).** Implement the contract + capability set from
`docs/design/domains/providers/prov-04-execution-host/` (`README.md` + `contracts-and-conformance.md`).
The contract must **not bake in locality** (remote is a later driver, AD-13). Ambiguous → STOP and surface.

## Spec surface (manifest)

- **`ExecutionHost`** interface — `probeCapabilities`, `attachWorkspace`, `spawnWorker`, `observeWorker`,
  `terminateWorker`, `runCommand`, `releaseWorkspace`.
- **Types** — `HostWorkspaceHandle`, `WorkerHandle` (**produced here; see Dependencies**),
  `SpawnWorkerRequest`/`WorkerLaunch`, `HostCommandRequest`, `HostInjectionContext`,
  `WorkspaceAttachment`, `HostObservation` (union: `output` | `structured-tool-exit` | `process-exit` |
  `host-failure`), `TerminationPolicy`, `TerminationProof`, `TerminationResult`, `CommandResult`,
  `HostReleaseResult`, `HostFailure`, `HostProbeScope`.
- **Capability set** — `HostCapability` = `canKill` | `containmentStrength` | `emitsStructuredToolExit`
  | `egress-confinement`; `ContainmentStrength` = `none` | `process-group` | `kernel-tree` |
  `job-object`. Attestation is the w2-1 `CapabilityAttestation` (+ `details`).
- **Verify-capture (`CommandResult`)** — `operationId`, `commandDigest`, `cwd`, `exitCode?`, `signal?`,
  `stdoutRef?`, `stderrRef?` (fnd-02 `ArtifactRef`), `outputDigest`, `redactionApplied`, `startedAt`,
  `finishedAt`.
- **Failure tokens (`HostFailureReason`, owned here)** — `host-capability-unattested`,
  `workspace-mount-unavailable`, `workspace-cwd-outside-mount`, `credential-injection-rejected`,
  `egress-confinement-unattested`, `worker-spawn-failed`, `host-observation-incomplete`,
  `termination-unproven`, `runner-command-capture-incomplete`, `credential-destroy-unconfirmed`.

## Responsibilities (in scope)

- The `ExecutionHost` contract + the capability set with egress **negative-probe** semantics.
- An **in-memory mock host** (deterministic spawn/terminate/verify) with adversarial cases (won't-die,
  false containment, egress-leak) + conformance cases.

## Out of scope

The native containment helper + real Local driver (driver track); the agent protocol (prov-01); local
git (fnd-03); credentialed forge ops (prov-02).

## Requirements owned

FR-3/FR-5/FR-6 (contract sides); NFR-EXT, NFR-TEST, NFR-SEC (egress attestation shape); **plus full
prov-04 contract spec compliance.**

## Dependencies & frozen contracts

Depends on `fnd-03` (workspace), `fnd-04` (`HostInjectionContext` projects the InjectionPlan), `w2-1`
(attestation + kit). **Produces (R5):** `WorkerHandle = { handleId, runId, operationId,
workspaceHandleId, ownershipClass: "owned" | "owned-remote" | "observe-only", containmentRef, startedAt }`
(`contracts-and-conformance.md`) — consumed verbatim by prov-01 as `AgentStartRequest.hostWorker`.
Consumed by core-04/05/06. Must NOT depend on core/edge/drivers/SDK.

## Libraries

`zod`, `conformance-kit`, `fast-check`. **No `execa`, no native helper, no real process** (driver track);
the mock simulates.

## Acceptance criteria (the shared rubric)

- **AC-1 (no locality, AD-13)** `WorkspaceAttachment.kind` validates both `"local-worktree"` and
  `"workspace-mount"`; no required local-path/PID field; the package compiles and the mock passes with
  no `execa`/`child_process`/native-helper import. — *README §4; AD-13; dependency-policy.md.*
- **AC-2 (terminate reaps the tree)** `terminateWorker` returns a `TerminationResult` whose
  `proof.containmentEmpty === true` only after all ladder steps are recorded; the `host-wont-die` mock
  returns `containmentEmpty === false` (not a throw) and a negative `canKill` attestation. — *README §4/§8.*
- **AC-3 (verify capture complete)** `runCommand` returns a `CommandResult` carrying `operationId`,
  `commandDigest`, `cwd`, `outputDigest`, `redactionApplied`, `startedAt`, `finishedAt`, exactly one of
  `exitCode`/`signal`, and fnd-02 `ArtifactRef` for `stdoutRef`/`stderrRef`; a missing field yields
  `HostFailure{ reason: "runner-command-capture-incomplete" }`, never a partial result. — *contracts (`CommandResult`).*
- **AC-4 (egress negative probe)** an `egress-leak` probe (disallowed host reachable) yields a
  `CapabilityAttestation` for `egress-confinement` with `result: "negative"`; a later op requiring it
  returns `HostFailure{ reason: "egress-confinement-unattested" }`. — *README §4/§8; contracts.*
- **AC-5 (honest containment)** the mock can report any `ContainmentStrength`; an unknown class yields a
  negative attestation; `details.containmentStrength` matches what was reported. — *contracts.*
- **AC-6 (injection party separation, AD-12)** `spawnWorker`/`runCommand` reject a request where
  `injection.party` ≠ the method's party, `injection.egressPolicy.audience` ≠ party, or
  `injection.operationId` ≠ `request.operationId` → `HostFailure{ reason: "credential-injection-rejected" }`. — *contracts.*
- **AC-7 (cwd containment)** `attachWorkspace` with a cwd escaping the mount returns
  `HostFailure{ reason: "workspace-cwd-outside-mount" }`. — *README §4/§8.*
- **AC-8 (redacted observations)** every `HostObservation` of type `output` has `redactionApplied: true`
  and a valid `ArtifactRef`; property test: an arbitrary injected secret never appears in the captured
  artifact. — *contracts; testing-policy.md.*
- **AC-9 (release destroys creds)** `releaseWorkspace` returns `credentialMaterialDestroyed: true` only
  when all injected material is gone; a scripted failure yields `false` +
  `credential-destroy-unconfirmed`. — *contracts (`HostReleaseResult`); README §8.*
- **AC-10 (scoped probe)** `probeCapabilities` returns attestations only for the capabilities named in
  `HostProbeScope.capabilities` (empty scope → empty array). — *contracts (`HostProbeScope`).*
- **AC-11 (mock = contract)** the mock structurally satisfies `ExecutionHost` (compile-time), all seven
  methods, exact return types; passes the conformance kit. — *contracts; w2-1 kit.*

## Failure & degraded outcomes (first-class)

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `termination-unproven` / `host-wont-die` | a ladder step missing / process survives | `containmentEmpty: false`; `canKill` negative; not thrown | AC-2 |
| `egress-confinement-unattested` / `egress-leak` | disallowed host reachable, or attestation stale/wrong-scope | egress attestation negative; dependent op fails closed | AC-4 |
| `false-containment` | mock reports a stronger `ContainmentStrength` than real | gate consumes attested value only; honest-vs-lying case asserts this | AC-5 |
| `credential-injection-rejected` | party / audience / operationId mismatch | `HostFailure`; no spawn/run | AC-6 |
| `workspace-cwd-outside-mount` | cwd escapes the mount | `HostFailure` | AC-7 |
| `runner-command-capture-incomplete` | a `CommandResult` field missing | `HostFailure`; never a partial result | AC-3 |
| `credential-destroy-unconfirmed` | release can't confirm destruction | `credentialMaterialDestroyed: false`; not thrown | AC-9 |
| `host-observation-incomplete` | observation omitted/corrupted | emit a `host-failure` observation with this reason | AC-8 |

## Quality bar

- Coverage ≥ 90% lines/branches (aim 95%), enforced by
  `vitest run --coverage --coverage.thresholds.lines=90 --coverage.thresholds.branches=90` for the
  contract + mock packages (paste the number).
- Required tests (catalogue): type-only `satisfies ExecutionHost`; schema probes for `WorkspaceAttachment`
  (both kinds), `CommandResult` (both variants), `CapabilityAttestation`; the termination happy-path +
  `host-wont-die` + partial-ladder; the egress negative-probe + stale-attestation; the four
  `ContainmentStrength` values + unknown; party/operationId mismatch; cwd traversal; the output-redaction
  property; release confirmed/unconfirmed; depcruise no-execa lane.
- File ≤ 800 lines; clock/id injected; no SDK / `child_process`.

## Required reading

This domain's spec (`README.md` + `contracts-and-conformance.md`); `decisions.md` AD-2/AD-12/AD-13;
`dependency-policy.md` (execa ban); `testing-policy.md`; `w2-1`; `fnd-02`'s `ArtifactRef`. Nothing else.

## Deliverable

The Execution Host contract package + mock host, passing the conformance kit; the egress/termination
capability types with negative-probe shape. Plus the evidence pack (test-per-AC, coverage, depcruise).

## Boundaries

Contract + mock only. The termination *ladder* and real containment are the driver's job — here, specify
the contract they must satisfy and simulate it. Never import `execa`/`child_process`. If the contract
can't express a containment guarantee the design requires, **STOP and surface**.

## Open questions (cross-item — surface to the core waves, do not resolve here)

- **Q1 (linkage to prov-01).** The spec does not state that `WorkerHandle.operationId` must equal
  `AgentStartRequest.operationId`, nor that `WorkerHandle.handleId` equals `AgentSession.hostWorkerHandleId`.
  This equality is a **core obligation** (core-02/04), not a contract assertion — surfaced, not invented.
- **Q2.** `observeWorker` returns `AsyncIterable<HostObservation>` but the spec does not define
  consumer-side cancellation/back-pressure; the mock chooses a behavior and flags it.
- **Q3.** `emitsStructuredToolExit` is a Host capability here **and** an Agent capability in prov-01;
  the spec disambiguates via core-02 `AttestationRef.provider`. The contract cannot import that core
  type — note the distinction; do not resolve in W2.
- **Q4.** `WorkspaceAttachment.mountRef` (remote) and `TerminationPolicy.initialSignal` are unvalidated
  free fields in the spec; the mock accepts them structurally and makes no behavioral claim.
