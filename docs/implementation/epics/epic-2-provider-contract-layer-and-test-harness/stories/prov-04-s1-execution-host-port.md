---
title: "prov-04-s1-execution-host-port - SDK Execution Host provider port implementation story"
id: "prov-04-s1-execution-host-port"
epic: 2
status: "story: ready"
design:
  - "docs/design/20-sdk-and-packaging/provider-ports.md"
---

# prov-04-s1-execution-host-port - SDK Execution Host Provider Port

## Purpose

Define the SDK-owned `ExecutionHostProvider` interface, its workspace/worker/observation/command/
termination DTO catalog, its `HostCapability` attestation specialization, and its host failure tokens,
as a type-only port the testkit mock and (later) the Epic 6 Local driver implement.

## Normative design

- `docs/design/20-sdk-and-packaging/provider-ports.md` — "Execution host provider" (the
  `ExecutionHostProvider` interface, all host DTOs, the `HostCapability`/`ContainmentStrength`/
  `CommandKind`/`HostFailureReason` unions, and `HostAttestationDetails`) and "External supporting
  types" (`WorkerHandle` is owned by this seam's Execution Host section).
- `docs/design/20-sdk-and-packaging/provider-interface-model.md` — capability attestation ownership
  (SDK owns the type; a capability is trusted only when freshly and positively attested — self-report
  is never sufficient) and the type-only-port boundary.
- `docs/design/20-sdk-and-packaging/sdk-boundary.md`, `dependency-rules.md` — `sdk` may import only
  pure runtime libraries; no `execa`, `child_process`, network clients, or concrete driver clients.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`
  — `PackageExportConvention` for the public `sdk` entrypoint.
- `docs/engineering/testing-policy.md`, `docs/engineering/test-lanes.md`,
  `docs/engineering/dependency-policy.md`.

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name (runtime
types variant):

- Interfaces / types — `ExecutionHostProvider`; DTOs `WorkspaceAttachment`, `HostWorkspaceHandle`,
  `HostInjectionContext`, `WorkerLaunch`, `SpawnWorkerRequest`, `HostCommandRequest`, `CommandResult`,
  `WorkerHandle`, `TerminationPolicy`, `TerminationProof`, `TerminationResult`, `HostReleaseResult`,
  `HostFailure`, `HostProbeScope`, `HostAttestationDetails`; unions `HostCapability`
  (`"canKill" | "containmentStrength" | "emitsStructuredToolExit" | "egress-confinement"`),
  `ContainmentStrength` (`"none" | "process-group" | "kernel-tree" | "job-object"`), `CommandKind`
  (`"repo-setup" | "verify" | "diagnostic"`), `HostFailureReason`; the `HostObservation` discriminated
  union with arms `"output" | "structured-tool-exit" | "process-exit" | "host-failure"`.
- Provider operations / commands — `probeCapabilities(scope: HostProbeScope): CapabilityAttestation<HostCapability>[]`;
  `attachWorkspace(workspace: WorkspaceAttachment): HostWorkspaceHandle | HostFailure`;
  `spawnWorker(request: SpawnWorkerRequest): WorkerHandle | HostFailure`;
  `observeWorker(handle: WorkerHandle): AsyncIterable<HostObservation>`;
  `terminateWorker(handle: WorkerHandle, policy: TerminationPolicy): TerminationResult`;
  `runCommand(request: HostCommandRequest): CommandResult | HostFailure`;
  `releaseWorkspace(handle: HostWorkspaceHandle): HostReleaseResult`.
- Failure and degraded tokens — `HostFailureReason` members (10): `host-capability-unattested`,
  `workspace-mount-unavailable`, `workspace-cwd-outside-mount`, `credential-injection-rejected`,
  `egress-confinement-unattested`, `worker-spawn-failed`, `host-observation-incomplete`,
  `termination-unproven`, `runner-command-capture-incomplete`, `credential-destroy-unconfirmed`. Each
  is carried on `HostFailure.reason` (or, for observation, in the `"host-failure"` arm of
  `HostObservation`).
- Evidence records / attestations — `CapabilityAttestation<HostCapability>[]` from
  `probeCapabilities`; `HostAttestationDetails` (fields `containmentStrength?`,
  `negativeProbeResults?`, `egressPolicyDigest?`) exposed as this seam's attestation-detail payload;
  `TerminationProof` (fields `signalSent`, `graceObserved`, `forceKillSent`, `reaped`,
  `containmentEmpty`, `evidenceRef`, `checkedAt`); `CommandResult` capture digests (`commandDigest`,
  `outputDigest`, `stdoutRef?`, `stderrRef?`); `HostReleaseResult.credentialMaterialDestroyed`.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Define the `ExecutionHostProvider` interface with exactly the seven design operations and their exact
  signatures (parameter and return types per the manifest).
- Define every host DTO named in the manifest with the design's exact fields and member literals,
  including the `HostObservation` discriminated union over its four `type` arms.
- Define the `HostCapability`, `ContainmentStrength`, `CommandKind`, and `HostFailureReason` unions with
  exactly the design's members and no others, keeping the four unions distinct.
- Own and produce `WorkerHandle` (the cross-seam DTO the Agent seam consumes via `AgentStartRequest`/
  `AgentResumeRequest`).
- Specialize the shared attestation envelope as `CapabilityAttestation<HostCapability>` for
  `probeCapabilities`, and expose `HostAttestationDetails` as this seam's attestation-detail payload.
- Make the safety invariants unrepresentable-or-rejected at the type/contract level: termination must
  carry a `TerminationProof`; `releaseWorkspace` must report `credentialMaterialDestroyed`;
  `runCommand` must carry capture digests; cwd outside the mount must be a rejected failure.
- Export the full type catalog from the `sdk` public entrypoint with no private-module imports.

## Out of scope

- The shared `CapabilityAttestation<Capability>` envelope, `CapabilityProvider`, and
  `CapabilityAttestationResult` — owned by `prov-00-s1-capability-attestation`; consumed, not
  redeclared.
- Epic 1 Foundation contracts (`CredentialParty`, `CredentialUsePlanned`, `EgressPolicy`,
  `InjectionBinding`, `RedactionSet`, `NegativeProbe`) — consumed as frozen inputs from `fnd-04`.
- The programmable mock host, conformance helpers, and incident fixtures — owned by
  `prov-04-s2-execution-host-testkit` (`packages/testkit`).
- Real process control, real kill/containment, real egress confinement, and live probes — owned by the
  Epic 6 Local driver; this story ships a type-only port with no runtime process behavior.
- The capability-gate evaluation that enforces freshness at run time — owned by core-02 (Epic 3).

## Dependencies and frozen inputs

- Covers signals: "SDK Execution Host provider interface and workspace/worker/host-observation/command/
  termination DTOs", and the `split` part "Execution Host capability attestations (kill, containment
  strength, structured tool exit, egress confinement)".
- Depends on: `prov-00-s1-capability-attestation`.
- Depended on by: `prov-01-s1-agent-port` (consumes `WorkerHandle`),
  `prov-04-s2-execution-host-testkit`.
- Shared shapes consumed: `prov-00-s1-capability-attestation/CapabilityAttestation` (specialized as
  `CapabilityAttestation<HostCapability>`); `fnd-04`'s `CredentialParty`, `CredentialUsePlanned`,
  `EgressPolicy`, `InjectionBinding`, `RedactionSet`, `NegativeProbe`.

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. A happy-path command
proves only successful acceptance; every rejection AC names its own failing fixture. The `evidence`
names the exact test id or command and the result it produces.

- **AC-1** `ExecutionHostProvider` declares exactly the seven operations `probeCapabilities`,
  `attachWorkspace`, `spawnWorker`, `observeWorker`, `terminateWorker`, `runCommand`,
  `releaseWorkspace`, each with the manifest signature (e.g. `spawnWorker(request: SpawnWorkerRequest):
  WorkerHandle | HostFailure`, `terminateWorker(handle: WorkerHandle, policy: TerminationPolicy):
  TerminationResult`) - evidence: `host-port-shape.unit.test.ts` constructs a conforming
  `ExecutionHostProvider` fixture and asserts a fixture missing one operation, or with a wrong return
  type, fails compilation (type-level fixture).
- **AC-2** Every host DTO is present with the design's exact fields: `WorkspaceAttachment`,
  `HostWorkspaceHandle`, `HostInjectionContext`, `WorkerLaunch`, `SpawnWorkerRequest`,
  `HostCommandRequest`, `CommandResult`, `WorkerHandle`, `TerminationPolicy`, `TerminationProof`,
  `TerminationResult`, `HostReleaseResult`, `HostFailure`, `HostProbeScope`, `HostAttestationDetails` -
  evidence: `host-dtos.unit.test.ts` constructs each DTO from a valid fixture and asserts a fixture
  omitting any required field (e.g. `TerminationResult.proof`, `CommandResult.outputDigest`) fails
  compilation (type-level fixtures, one per DTO).
- **AC-3** The four host unions have exactly their design members and no others: `HostCapability` =
  `"canKill" | "containmentStrength" | "emitsStructuredToolExit" | "egress-confinement"`;
  `ContainmentStrength` = `"none" | "process-group" | "kernel-tree" | "job-object"`; `CommandKind` =
  `"repo-setup" | "verify" | "diagnostic"`; `HostFailureReason` = the 10 manifest tokens - evidence:
  `host-unions.unit.test.ts` runs an exhaustiveness switch over each union (a fixture adding a fifth
  `HostCapability` member fails the `never` check).
- **AC-4** `HostObservation` is a discriminated union on `type` with exactly the four arms `"output"`,
  `"structured-tool-exit"`, `"process-exit"`, `"host-failure"`, each carrying its design fields (e.g.
  the `"output"` arm carries `redactionApplied: true` literally; the `"host-failure"` arm carries
  `failure: HostFailure`) - evidence: `host-observation.unit.test.ts` narrows each arm by `type` and
  asserts a fifth arm or an `"output"` arm with `redactionApplied: false` fails compilation.
- **AC-5** `probeCapabilities` returns `CapabilityAttestation<HostCapability>[]` specializing the
  `prov-00-s1-capability-attestation/CapabilityAttestation` envelope, and `HostAttestationDetails`
  (fields `containmentStrength?`, `negativeProbeResults?`, `egressPolicyDigest?`) is exposed as this
  seam's attestation-detail payload - evidence: `host-attestation.unit.test.ts` constructs a
  `CapabilityAttestation<"containmentStrength">` whose `details` is a `HostAttestationDetails`, and a
  fixture using a non-`HostCapability` capability literal fails compilation.
- **AC-6** Termination cannot be reported without proof: `terminateWorker` returns a `TerminationResult`
  carrying a required `TerminationProof` (`signalSent`, `graceObserved`, `forceKillSent`, `reaped`,
  `containmentEmpty`, `evidenceRef`, `checkedAt`); an unproven termination is a `TerminationResult`
  whose proof is incomplete (e.g. `containmentEmpty: false`), and the `"termination-unproven"` reason is
  surfaced as a `HostFailure` on the `HostObservation` `"host-failure"` arm — never as a
  `terminateWorker` return value, whose type is `TerminationResult` only - evidence:
  `host-termination.unit.test.ts` constructs a `TerminationResult` (proof required), an incomplete-proof
  fixture, and a `termination-unproven.fixture.ts` `HostFailure` carried on the `"host-failure"`
  observation arm, asserting a `TerminationResult` without `proof` fails compilation and that a
  `HostFailure` is not assignable to `terminateWorker`'s return type.
- **AC-7** Workspace release must confirm credential destruction and command runs must capture evidence:
  `HostReleaseResult` carries `credentialMaterialDestroyed: boolean`, `CommandResult` carries
  `commandDigest` and `outputDigest`, and the failure reasons `"credential-destroy-unconfirmed"` and
  `"runner-command-capture-incomplete"` are the contracted outcomes for the unconfirmed/incomplete
  cases - evidence: `host-release-capture.unit.test.ts` constructs both DTOs plus
  `credential-destroy-unconfirmed.fixture.ts` and `runner-command-capture-incomplete.fixture.ts`
  `HostFailure` values, asserting a `CommandResult` missing `outputDigest` fails compilation.
- **AC-8** Each of the 10 `HostFailureReason` tokens is constructible as a `HostFailure.reason` (or the
  `HostObservation` `"host-failure"` arm) via a named negative fixture asserting that token's trigger,
  including `workspace-cwd-outside-mount` for a `cwd` escaping the mount root - evidence:
  `host-failures.unit.test.ts` plus one fixture per token (`host-capability-unattested.fixture.ts` …
  `credential-destroy-unconfirmed.fixture.ts`) each asserting the token is the produced
  `HostFailure.reason`.
- **AC-9** Every manifest shape — `ExecutionHostProvider`, all 15 DTOs, the four unions, and
  `HostObservation` — is importable from the `sdk` package public entrypoint, not a private module
  path, and the port source imports no `execa`, `child_process`, `node:net`/`node:http`, or concrete
  driver client - evidence: `host-public-import.unit.test.ts` imports every shape from the `sdk`
  entrypoint and constructs one `ExecutionHostProvider` fixture; plus the forbidden-symbol sweep below
  reports zero matches.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| `ExecutionHostProvider` interface with seven operations and signatures | AC-1 |
| Host DTO catalog (15 DTOs) with exact fields | AC-2 |
| `HostCapability`/`ContainmentStrength`/`CommandKind`/`HostFailureReason` unions, kept distinct | AC-3 |
| `HostObservation` discriminated union (four arms) | AC-4 |
| `CapabilityAttestation<HostCapability>` specialization; `HostAttestationDetails` payload | AC-5 |
| Own/produce `WorkerHandle` (consumed by Agent seam) | AC-2, AC-9 |
| Termination carries required `TerminationProof`; unproven → `termination-unproven` | AC-6 |
| Release confirms credential destruction; command captures evidence digests | AC-7 |
| All 10 `HostFailureReason` tokens; `workspace-cwd-outside-mount` cwd-escape | AC-8 |
| Public exposure of the full type catalog; type-only port (no process/network imports) | AC-9 |

## Failure and degraded outcomes

Runtime token table. Each row's cited AC asserts this row's trigger and required behavior. As a
type-only port, the "required behavior" is the contracted token on `HostFailure.reason` (or the
`HostObservation` `"host-failure"` arm); the testkit story exercises the runtime emission.

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `host-capability-unattested` | An operation requires a `HostCapability` that has no fresh positive attestation. | Return `HostFailure` with this reason; do not proceed on self-report. | AC-8 |
| `workspace-mount-unavailable` | `attachWorkspace` targets a mount that is not available. | Return `HostFailure` with this reason; no `HostWorkspaceHandle`. | AC-8 |
| `workspace-cwd-outside-mount` | A request `cwd` resolves outside the workspace mount root. | Return `HostFailure` with this reason; reject the request. | AC-8 |
| `credential-injection-rejected` | `HostInjectionContext` bindings/scope fail validation at spawn/run. | Return `HostFailure` with this reason; no worker/command runs. | AC-8 |
| `egress-confinement-unattested` | An egress-confined operation lacks a fresh `egress-confinement` attestation. | Return `HostFailure` with this reason; do not run unconfined. | AC-8 |
| `worker-spawn-failed` | `spawnWorker` cannot launch the worker. | Return `HostFailure` with this reason; no `WorkerHandle`. | AC-8 |
| `host-observation-incomplete` | `observeWorker` cannot deliver a complete observation stream. | Emit the `"host-failure"` `HostObservation` arm with this reason. | AC-8 |
| `termination-unproven` | `terminateWorker` cannot produce a complete `TerminationProof`. | `terminateWorker` still returns a `TerminationResult` (proof incomplete, e.g. `containmentEmpty: false`); surface this reason as a `HostFailure` on the `HostObservation` `"host-failure"` arm — not as a `terminateWorker` return value. | AC-6, AC-8 |
| `runner-command-capture-incomplete` | `runCommand` cannot capture `commandDigest`/`outputDigest`/refs. | Return `HostFailure` with this reason rather than an uncaptured `CommandResult`. | AC-7, AC-8 |
| `credential-destroy-unconfirmed` | `releaseWorkspace` cannot confirm `credentialMaterialDestroyed`. | Return this reason rather than `released: true` with unconfirmed destruction. | AC-7, AC-8 |

## Quality bar

- Coverage scope and threshold: the runtime helpers in this story — the constructability/guard fixtures
  and any narrowing helpers over `HostObservation`/`HostFailure` — at 90% minimum, aiming for 95%.
  Type-only declarations (the interface, DTOs, and unions) are proven by the type-level fixtures in
  AC-1…AC-5, not by line coverage.
- Coverage command and instrumented lane(s): `pnpm coverage:baseline` instruments the unit lane for the
  aggregate gate; focused per-story report via `pnpm exec vitest run --project unit --coverage
  --passWithNoTests -- packages/sdk/tests/providers/execution-host/*.unit.test.ts`.
- Required tests, catalogued by AC and failure row: `host-port-shape.unit.test.ts` (AC-1);
  `host-dtos.unit.test.ts` (AC-2); `host-unions.unit.test.ts` (AC-3); `host-observation.unit.test.ts`
  (AC-4); `host-attestation.unit.test.ts` (AC-5); `host-termination.unit.test.ts` (AC-6);
  `host-release-capture.unit.test.ts` (AC-7); `host-failures.unit.test.ts` with one fixture per token
  (AC-8, every failure row); `host-public-import.unit.test.ts` (AC-9 and the forbidden-symbol sweep).
- Public exposure (import path + public-import test): `ExecutionHostProvider`, all 15 DTOs,
  `HostCapability`, `ContainmentStrength`, `CommandKind`, `HostFailureReason`, and `HostObservation`
  exported from the `sdk` public entrypoint per `epic0-s4-export-templates/PackageExportConvention`;
  proven by `host-public-import.unit.test.ts`. `WorkerHandle` must be importable for `prov-01-s1-agent-port`.
- Constructability: a fixture constructs each public shape; the safety invariants are constructable only
  in their proven form (`TerminationResult` requires `proof`; `CommandResult` requires `outputDigest`;
  `HostReleaseResult` carries `credentialMaterialDestroyed`) — no shape requires an impossible field
  combination.
- Determinism constraints: all shapes are pure type declarations and pure fixture builders; no clock,
  randomness, process, or I/O (`at`/`startedAt`/`expiresAt`/`checkedAt` are caller-supplied strings).
- Dependency boundaries: `sdk` may import only pure runtime libraries (zod) plus
  `prov-00-s1-capability-attestation` and `fnd-04` SDK types; it must not import `testkit`, any
  `provider-*`, `cli`, or `mcp`, and the port source must contain no `execa`, `child_process`, network
  client, or concrete driver client (`dependency-rules.md`).
- File-size budget (lines per file; default soft cap ~200): split the interface, the DTO catalog, the
  unions, and the attestation specialization into separate focused files, each ≤ 200 lines.
- Domain non-negotiables: a host capability is trusted only when freshly and positively attested;
  termination is never reported without a complete `TerminationProof`; workspace release is never
  reported as successful with unconfirmed credential destruction; the port is type-only (no real
  process/network/credential behavior — that is the Epic 6 Local driver).

### Forbidden-symbol sweep (runnable recipe)

```sh
grep -REn "execa|child_process|node:net|node:http|node:https|@octokit|net\\.connect|spawn\\(" \
  packages/sdk/src/providers/execution-host/
```

- Path root: `packages/sdk/src/providers/execution-host/`.
- Forbidden-token set: `execa`, `child_process`, `node:net`, `node:http`, `node:https`, `@octokit`,
  `net.connect`, `spawn(`.
- Expected result: zero matches (exit code 1, no lines), captured into the evidence pack. A non-empty
  match means the type-only port leaked a process/network dependency and fails this story.

## Required reading

- `docs/design/20-sdk-and-packaging/provider-ports.md` ("Execution host provider"; "External supporting
  types").
- `docs/design/20-sdk-and-packaging/provider-interface-model.md` (capability attestation ownership and
  freshness invariant).
- `docs/design/20-sdk-and-packaging/dependency-rules.md`, `sdk-boundary.md`.
- `prov-00-s1-capability-attestation` story contract (the `CapabilityAttestation` envelope it produces).
- `epic0-s4-export-templates` story contract; `docs/engineering/test-lanes.md`.

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The `packages/sdk` Execution Host provider port — `ExecutionHostProvider`, its host DTO catalog, its
four unions, the `HostObservation` discriminated union, the `CapabilityAttestation<HostCapability>`
specialization, and `HostAttestationDetails` — exposed on the `sdk` public entrypoint, plus the
evidence pack.

## Evidence pack

- Test name or artifact proving each AC (catalogued above).
- Test name or artifact proving each failure/degraded row (one negative fixture per `HostFailureReason`
  token, plus the `termination-unproven`, `credential-destroy-unconfirmed`, and
  `runner-command-capture-incomplete` fail-closed fixtures and the `workspace-cwd-outside-mount`
  cwd-escape fixture).
- Negative fixture for every rejection: `host-capability-unattested.fixture.ts` …
  `credential-destroy-unconfirmed.fixture.ts` (10 tokens), plus the type-level "missing required field"
  fixtures for `TerminationResult.proof` and `CommandResult.outputDigest`.
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command, instrumented lane, and number for the stated helper scope.
- Public-import test result for every exposed shape, imported through the `sdk` entrypoint.
- Forbidden-symbol sweep: the exact command above, path root, forbidden-token set, and zero-match
  output, captured.
- Conformance evidence is recorded/in-memory only (type-level and constructed fixtures); no real
  process, network, or credential — real driver attestation is Epic 6.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/providers/execution-host` only.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/providers/execution-host/**`, `packages/sdk/tests/providers/execution-host/**`.
- Forbidden dependencies: no `testkit`, no `provider-*`, no `cli`/`mcp`, no `execa`/`child_process`/
  network client/concrete driver client; do not redeclare `CapabilityAttestation` or any `fnd-04`
  Foundation type.
- STOP when: a requirement needs real process control, real kill/containment, live egress confinement,
  or a real probe (Epic 6 Local driver); needs the mock host or conformance helpers
  (`prov-04-s2-execution-host-testkit`); needs the freshness-gate evaluation (core-02, Epic 3); or
  needs a host shape the `provider-ports.md` design does not name.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 2 - stories](./README.md) · **← Prev:** [prov-03-s2-work-source-testkit - Work Source testkit and conformance implementation story](./prov-03-s2-work-source-testkit.md) · **Next →:** [prov-04-s2-execution-host-testkit - testkit Execution Host mock, conformance, and incident fixtures implementation story](./prov-04-s2-execution-host-testkit.md)

<!-- /DOCS-NAV -->
