---
title: "prov-01-s1-agent-port - SDK Agent provider port implementation story"
id: "prov-01-s1-agent-port"
epic: 2
status: "story: ready"
design:
  - "docs/design/20-sdk-and-packaging/provider-ports.md"
---

# prov-01-s1-agent-port - SDK Agent Provider Port

## Purpose

Define the SDK-owned `AgentProvider` interface, its shared agent DTO catalog, the seven-arm `AgentEvent`
discriminated union, the Agent capability attestation specialization, and the Agent failure tokens, as a
type-only port the testkit mock and (later) the Epic 6 Codex driver implement.

## Normative design

- `docs/design/20-sdk-and-packaging/provider-ports.md` — "Agent provider" (the `AgentProvider`
  interface; the DTOs `AgentProbeScope`, `AgentStartRequest`, `AgentOutputSink`, `AgentSession`,
  `ApprovalAnswerChannel`, `ScopedGrant`, `ApprovalAnswer`, `AgentApprovalRequest`, `ToolObserved`,
  `GuardianReviewObserved`, `AgentFailure`, `AgentResumeRequest`, `ApprovalAnswerResult`,
  `AgentReleaseResult`; the `AgentEvent` union; the `AgentCapability`, `AgentTerminalReason`,
  `ApprovalKind`, `ScopedGrantKind`, and `AgentFailureReason` unions).
- `docs/design/20-sdk-and-packaging/provider-interface-model.md` — capability attestation ownership (SDK
  owns the type; a capability is trusted only when freshly and positively attested — self-report is
  never sufficient) and the type-only-port boundary.
- `docs/design/20-sdk-and-packaging/sdk-boundary.md`, `dependency-rules.md` — `sdk` may import only pure
  runtime libraries; no `execa`, `child_process`, network clients, MCP/app-server runtime, or concrete
  driver clients.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`
  — `PackageExportConvention` for the public `sdk` entrypoint.
- `docs/engineering/testing-policy.md`, `docs/engineering/test-lanes.md`,
  `docs/engineering/dependency-policy.md`.

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose or consume, by name (runtime types
variant):

- Interfaces / types — `AgentProvider`; DTOs `AgentProbeScope`, `AgentStartRequest`, `AgentOutputSink`,
  `AgentSession`, `ApprovalAnswerChannel`, `ScopedGrant`, `ApprovalAnswer`, `AgentApprovalRequest`,
  `ToolObserved`, `GuardianReviewObserved`, `AgentFailure`, `AgentResumeRequest`, `ApprovalAnswerResult`,
  `AgentReleaseResult`; unions `AgentCapability`
  (`"canRelayApproval" | "canPersistApprovalAnswerChannel" | "canResumeOwned" | "emitsStructuredToolExit"
  | "emitsGuardianReview" | "preservesHostProcessParentage"`), `AgentTerminalReason`
  (`"completed" | "failed" | "interrupted" | "approval-parked" | "provider-lost" | "host-lost"`),
  `ApprovalKind` (`"command-execution" | "file-change" | "permissions" | "mcp-elicitation" |
  "tool-user-input" | "apply-patch" | "legacy-exec"`), `ScopedGrantKind` (the 12 members
  `"command-once" | "command-session" | "command-policy-amendment" | "file-change-once" |
  "file-change-session" | "filesystem-permission" | "network-permission" | "mcp-elicitation-content" |
  "tool-user-input-content" | "deny-continue" | "deny-interrupt" | "deny-park"`), `AgentFailureReason`;
  the `AgentEvent` discriminated union with the seven arms
  `"linked" | "progress" | "approval-requested" | "tool-observed" | "guardian-review" | "degraded" |
  "terminal"`.
- Provider operations / commands —
  `probeCapabilities(scope: AgentProbeScope): CapabilityAttestation<AgentCapability>[]`;
  `startWorker(request: AgentStartRequest): AgentSession | AgentFailure`;
  `observe(session: AgentSession): AsyncIterable<AgentEvent>`;
  `answerApproval(session: AgentSession, answer: ApprovalAnswer): ApprovalAnswerResult`;
  `resumeOwned(request: AgentResumeRequest): AgentSession | AgentFailure`;
  `stopObserving(session: AgentSession): AgentReleaseResult`.
- Failure and degraded tokens — `AgentFailureReason` members (10): `agent-capability-unattested`,
  `agent-linkage-lost`, `approval-relay-unattested`, `approval-answer-channel-lost`,
  `agent-resume-unattested`, `structured-tool-exit-missing`, `tool-output-ref-missing`,
  `guardian-review-untrusted`, `host-parentage-unproven`, `agent-terminal-ambiguous`. Each is carried on
  `AgentFailure.reason` (returned by `startWorker`/`resumeOwned`, or carried in the `"degraded"` arm of
  `AgentEvent`).
- Evidence records / attestations — `CapabilityAttestation<AgentCapability>[]` from `probeCapabilities`,
  one per `AgentCapability` member (approval relay → `canRelayApproval`; answer-channel persistence →
  `canPersistApprovalAnswerChannel`; resume → `canResumeOwned`; structured tool exit →
  `emitsStructuredToolExit`; Guardian observation → `emitsGuardianReview`; host parentage →
  `preservesHostProcessParentage`); `ApprovalAnswerChannel` (`evidenceRef`, `persistable`) and
  `AgentFailure.evidenceRef`/`ApprovalAnswerResult.evidenceRef`/`AgentReleaseResult.evidenceRef` as the
  per-operation evidence references.

Done requires every item here present with the design's names, shapes, and semantics.

## Responsibilities

- Define the `AgentProvider` interface with exactly the six design operations and their exact signatures
  (parameter and return types per the manifest).
- Define every agent DTO named in the manifest with the design's exact fields and member literals.
- Define the `AgentEvent` discriminated union over its seven `type` arms, each carrying its design
  payload.
- Define the `AgentCapability`, `AgentTerminalReason`, `ApprovalKind`, and `ScopedGrantKind` unions with
  exactly the design's members and no others, keeping the four unions distinct.
- Specialize the shared attestation envelope as `CapabilityAttestation<AgentCapability>` for
  `probeCapabilities`, one attestation per Agent capability (approval relay, answer-channel persistence,
  resume, structured tool exit, Guardian observation, host parentage).
- Consume `prov-04-s1-execution-host-port/WorkerHandle` as `AgentStartRequest.hostWorker` and
  `AgentResumeRequest.hostWorker` without redeclaring it.
- Make the safety invariants unrepresentable-or-rejected at the type/contract level: an unattested
  capability, lost linkage, untrusted Guardian review, unproven host parentage, missing structured tool
  exit, and an ambiguous terminal are each a contracted `AgentFailureReason`, not a silent proceed.
- Export the full type catalog from the `sdk` public entrypoint with no private-module imports.

## Out of scope

- The shared `CapabilityAttestation<Capability>` envelope, `CapabilityProvider`, and
  `CapabilityAttestationResult` — owned by `prov-00-s1-capability-attestation`; consumed, not redeclared.
- `WorkerHandle` — owned by `prov-04-s1-execution-host-port` (Execution Host section); consumed via
  `AgentStartRequest.hostWorker`/`AgentResumeRequest.hostWorker`, never redeclared here.
- The programmable mock Agent provider, its positive/degraded/adversarial event streams, and conformance
  helpers — owned by `prov-01-s2-agent-testkit` (`packages/testkit`).
- Real Codex MCP-server / app-server protocol handling, real approval relay, real session resume, and
  live probes — owned by the Epic 6 Codex Agent driver; this story ships a type-only port with no runtime
  agent behavior.
- The capability-gate evaluation that enforces freshness at run time, and run-log envelope event-id
  assignment — owned by core stories (Epic 3).

## Dependencies and frozen inputs

- Covers signals: "SDK Agent provider interface and shared DTO catalog", and the `split` part "Agent
  capability attestations for approval relay, resume, structured tool exit, Guardian observation, and
  host parentage evidence."
- Depends on: `prov-00-s1-capability-attestation`, `prov-04-s1-execution-host-port`.
- Depended on by: `prov-01-s2-agent-testkit`.
- Shared shapes consumed: `prov-00-s1-capability-attestation/CapabilityAttestation` (specialized as
  `CapabilityAttestation<AgentCapability>`); `prov-04-s1-execution-host-port/WorkerHandle` (consumed in
  `AgentStartRequest.hostWorker` and `AgentResumeRequest.hostWorker`).

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

## Acceptance criteria

Each AC is a single assertion that is true or false against a test or artifact. A happy-path command
proves only successful acceptance; every rejection AC names its own failing fixture. The `evidence` names
the exact test id or command and the result it produces.

- **AC-1** `AgentProvider` declares exactly the six operations `probeCapabilities`, `startWorker`,
  `observe`, `answerApproval`, `resumeOwned`, `stopObserving`, each with the manifest signature (e.g.
  `startWorker(request: AgentStartRequest): AgentSession | AgentFailure`, `observe(session: AgentSession):
  AsyncIterable<AgentEvent>`, `answerApproval(session: AgentSession, answer: ApprovalAnswer):
  ApprovalAnswerResult`) - evidence: `agent-port-shape.unit.test.ts` constructs a conforming
  `AgentProvider` fixture and asserts a fixture missing one operation, or with a wrong return type, fails
  compilation (type-level fixture).
- **AC-2** Every agent DTO is present with the design's exact fields: `AgentProbeScope`,
  `AgentStartRequest`, `AgentOutputSink`, `AgentSession`, `ApprovalAnswerChannel`, `ScopedGrant`,
  `ApprovalAnswer`, `AgentApprovalRequest`, `ToolObserved`, `GuardianReviewObserved`, `AgentFailure`,
  `AgentResumeRequest`, `ApprovalAnswerResult`, `AgentReleaseResult` - evidence: `agent-dtos.unit.test.ts`
  constructs each DTO from a valid fixture and asserts a fixture omitting any required field (e.g.
  `ToolObserved.outputRef`, `AgentSession.hostWorkerHandleId`) fails compilation (type-level fixtures,
  one per DTO).
- **AC-3** `AgentStartRequest.hostWorker` and `AgentResumeRequest.hostWorker` are typed as the consumed
  `prov-04-s1-execution-host-port/WorkerHandle` (not a redeclared shape), and a fixture constructs an
  `AgentStartRequest` whose `hostWorker` is a `WorkerHandle` imported from the `sdk` entrypoint -
  evidence: `agent-host-worker.unit.test.ts` builds an `AgentStartRequest` and `AgentResumeRequest` using
  an imported `WorkerHandle` value and asserts assigning a non-`WorkerHandle` object to `hostWorker` fails
  compilation; a repo grep proves no local `interface WorkerHandle` declaration under the owned source.
- **AC-4** `AgentEvent` is a discriminated union on `type` with exactly the seven arms `"linked"`,
  `"progress"`, `"approval-requested"`, `"tool-observed"`, `"guardian-review"`, `"degraded"`,
  `"terminal"`, each carrying its design payload (e.g. the `"approval-requested"` arm carries
  `request: AgentApprovalRequest`; the `"degraded"` arm carries `failure: AgentFailure`; the `"terminal"`
  arm carries `reason: AgentTerminalReason`) - evidence: `agent-event.unit.test.ts` narrows each arm by
  `type` in an exhaustiveness switch and asserts an eighth arm, or a `"terminal"` arm whose `reason` is
  not an `AgentTerminalReason`, fails compilation.
- **AC-5** The four agent unions have exactly their design members and no others: `AgentCapability` =
  the six members `"canRelayApproval" | "canPersistApprovalAnswerChannel" | "canResumeOwned" |
  "emitsStructuredToolExit" | "emitsGuardianReview" | "preservesHostProcessParentage"`;
  `AgentTerminalReason` = the six members `"completed" | "failed" | "interrupted" | "approval-parked" |
  "provider-lost" | "host-lost"`; `ApprovalKind` = the seven members listed in the manifest;
  `ScopedGrantKind` = the 12 members listed in the manifest - evidence: `agent-unions.unit.test.ts` runs
  an exhaustiveness switch over each union (a fixture adding a seventh `AgentCapability` member or a
  seventh `AgentTerminalReason` member fails the `never` check).
- **AC-6** `probeCapabilities` returns `CapabilityAttestation<AgentCapability>[]` specializing the
  `prov-00-s1-capability-attestation/CapabilityAttestation` envelope, with a constructible attestation for
  each of the six `AgentCapability` members (approval relay, answer-channel persistence, resume,
  structured tool exit, Guardian observation, host parentage) - evidence:
  `agent-attestation.unit.test.ts` constructs a `CapabilityAttestation<"canRelayApproval">` and one per
  remaining member, and asserts a fixture using a non-`AgentCapability` capability literal fails
  compilation.
- **AC-7** Each of the 10 `AgentFailureReason` tokens is constructible as an `AgentFailure.reason` (or the
  `AgentEvent` `"degraded"` arm) via its own named negative fixture asserting that token's trigger -
  evidence: `agent-failures.unit.test.ts` plus one fixture per token (`agent-capability-unattested.fixture.ts`
  … `agent-terminal-ambiguous.fixture.ts`, 10 fixtures) each asserting the token is the produced
  `AgentFailure.reason`.
- **AC-8** Every manifest shape — `AgentProvider`, all 14 DTOs, the four unions, and `AgentEvent` — is
  importable from the `sdk` package public entrypoint, not a private module path - evidence:
  `agent-public-import.unit.test.ts` imports every shape from the `sdk` entrypoint and constructs one
  `AgentProvider` fixture.
- **AC-9** The Agent port source imports no concrete Codex client, no MCP-server / app-server runtime, and
  no network/process client, keeping it a type-only port (the concrete Codex Agent is Epic 6) - evidence:
  the forbidden-symbol sweep below over `packages/sdk/src/providers/agent/` reports zero matches (exit
  code 1, no lines), captured into the evidence pack.

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| `AgentProvider` interface with six operations and signatures | AC-1 |
| Agent DTO catalog (14 DTOs) with exact fields | AC-2 |
| Consume `prov-04-s1-execution-host-port/WorkerHandle` in `hostWorker` (not redeclared) | AC-3 |
| `AgentEvent` discriminated union (seven arms) | AC-4 |
| `AgentCapability`/`AgentTerminalReason`/`ApprovalKind`/`ScopedGrantKind` unions, kept distinct | AC-5 |
| `CapabilityAttestation<AgentCapability>` specialization; one attestation per Agent capability | AC-6 |
| All 10 `AgentFailureReason` tokens (unattested / linkage / Guardian / parentage / tool-exit / terminal) | AC-7 |
| Public exposure of the full type catalog | AC-8 |
| Type-only port (no concrete Codex / MCP-runtime / network imports) | AC-9 |

## Failure and degraded outcomes

Runtime token table. Each row's cited AC asserts this row's trigger and required behavior. As a type-only
port, the "required behavior" is the contracted token on `AgentFailure.reason` (or the `AgentEvent`
`"degraded"` arm); the testkit story exercises the runtime emission.

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `agent-capability-unattested` | An operation requires an `AgentCapability` (e.g. approval relay or resume) with no fresh positive attestation. | Return `AgentFailure` with this reason; the worker must not proceed on the unattested capability. | AC-7 |
| `agent-linkage-lost` | The session's provider linkage to the agent is lost. | Return `AgentFailure` with this reason; do not report a live session. | AC-7 |
| `approval-relay-unattested` | An approval relay is attempted without a fresh `canRelayApproval` attestation. | Return `AgentFailure` with this reason; do not relay the approval. | AC-7 |
| `approval-answer-channel-lost` | The `ApprovalAnswerChannel` for an approval can no longer be reached. | Return `AgentFailure` with this reason; do not report the answer delivered. | AC-7 |
| `agent-resume-unattested` | `resumeOwned` is attempted without a fresh `canResumeOwned` attestation. | Return `AgentFailure` with this reason; do not resume the session. | AC-7 |
| `structured-tool-exit-missing` | A tool observation lacks the structured tool exit (`emitsStructuredToolExit` not honored). | Return `AgentFailure` with this reason; do not treat the tool as cleanly exited. | AC-7 |
| `tool-output-ref-missing` | A `ToolObserved` has no resolvable `outputRef`. | Return `AgentFailure` with this reason; do not report captured output. | AC-7 |
| `guardian-review-untrusted` | A `GuardianReviewObserved` is not trustworthy (e.g. not `stable`). | Return `AgentFailure` with this reason; do not treat the Guardian review as authoritative. | AC-7 |
| `host-parentage-unproven` | Host process parentage for the worker cannot be proven (`preservesHostProcessParentage` not established). | Return `AgentFailure` with this reason; do not proceed without proven parentage. | AC-7 |
| `agent-terminal-ambiguous` | A terminal outcome cannot be resolved to a single `AgentTerminalReason`. | Return `AgentFailure` with this reason rather than an ambiguous `"terminal"` event. | AC-7 |

## Quality bar

- Coverage scope and threshold: the runtime helpers in this story — the constructability fixtures and any
  narrowing helpers over `AgentEvent`/`AgentFailure` — at 90% minimum, aiming for 95%. Type-only
  declarations (the interface, DTOs, and unions) are proven by the type-level fixtures in AC-1…AC-6, not
  by line coverage.
- Coverage command and instrumented lane(s): `pnpm coverage:baseline` instruments the unit lane for the
  aggregate gate; focused per-story report via `pnpm exec vitest run --project unit --coverage
  --passWithNoTests -- packages/sdk/tests/providers/agent/*.unit.test.ts`.
- Required tests, catalogued by AC and failure row: `agent-port-shape.unit.test.ts` (AC-1);
  `agent-dtos.unit.test.ts` (AC-2); `agent-host-worker.unit.test.ts` (AC-3); `agent-event.unit.test.ts`
  (AC-4); `agent-unions.unit.test.ts` (AC-5); `agent-attestation.unit.test.ts` (AC-6);
  `agent-failures.unit.test.ts` with one fixture per token (AC-7, every failure row);
  `agent-public-import.unit.test.ts` (AC-8); the forbidden-symbol sweep (AC-9).
- Public exposure (import path + public-import test): `AgentProvider`, all 14 DTOs, `AgentCapability`,
  `AgentTerminalReason`, `ApprovalKind`, `ScopedGrantKind`, `AgentFailureReason`, and `AgentEvent`
  exported from the `sdk` public entrypoint per `epic0-s4-export-templates/PackageExportConvention`;
  proven by `agent-public-import.unit.test.ts`.
- Constructability: a fixture constructs each public shape; `AgentStartRequest` is constructible only with
  a `hostWorker: WorkerHandle` (the consumed type) and `AgentSession` only with `hostWorkerHandleId`; no
  shape requires an impossible field combination.
- Determinism constraints: all shapes are pure type declarations and pure fixture builders; no clock,
  randomness, process, or I/O (`at`/`startedAt`/`expiresAt` are caller-supplied strings).
- Dependency boundaries: `sdk` may import only pure runtime libraries (zod) plus
  `prov-00-s1-capability-attestation` and `prov-04-s1-execution-host-port` SDK types; it must not import
  `testkit`, any `provider-*`, `cli`, or `mcp`, and the port source must contain no concrete Codex
  client, MCP-server / app-server runtime, network client, `execa`, or `child_process`
  (`dependency-rules.md`).
- File-size budget (lines per file; default soft cap ~200): split the interface, the DTO catalog, the
  `AgentEvent` union, the four enum unions, and the attestation specialization into separate focused
  files, each ≤ 200 lines.
- Domain non-negotiables: an Agent capability is trusted only when freshly and positively attested (an
  unattested capability is `agent-capability-unattested`, not a silent proceed); a structured tool exit
  or output reference that is missing is a failure token, not an assumed success; an untrusted Guardian
  review and unproven host parentage are failures; an unresolvable terminal is `agent-terminal-ambiguous`;
  the port is type-only (no real Codex / MCP / network behavior — that is the Epic 6 Codex driver).

### Forbidden-symbol sweep (runnable recipe)

```sh
grep -REn "execa|child_process|@modelcontextprotocol|codex-app-server|app-server|mcp-server|node:net|node:http|node:https|@octokit|net\\.connect|spawn\\(|new WebSocket" \
  packages/sdk/src/providers/agent/
```

- Path root: `packages/sdk/src/providers/agent/`.
- Forbidden-token set: `execa`, `child_process`, `@modelcontextprotocol`, `codex-app-server`,
  `app-server`, `mcp-server`, `node:net`, `node:http`, `node:https`, `@octokit`, `net.connect`,
  `spawn(`, `new WebSocket`.
- Expected result: zero matches (exit code 1, no lines), captured into the evidence pack. A non-empty
  match means the type-only port leaked a concrete Codex client, an MCP/app-server runtime, or a
  process/network dependency and fails this story.

## Required reading

- `docs/design/20-sdk-and-packaging/provider-ports.md` ("Agent provider").
- `docs/design/20-sdk-and-packaging/provider-interface-model.md` (capability attestation ownership and
  freshness invariant).
- `docs/design/20-sdk-and-packaging/dependency-rules.md`, `sdk-boundary.md`.
- `prov-00-s1-capability-attestation` story contract (the `CapabilityAttestation` envelope it produces).
- `prov-04-s1-execution-host-port` story contract (the `WorkerHandle` it owns and produces).
- `epic0-s4-export-templates` story contract; `docs/engineering/test-lanes.md`.

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The `packages/sdk` Agent provider port — `AgentProvider`, its 14 agent DTOs, the four unions, the
seven-arm `AgentEvent` discriminated union, and the `CapabilityAttestation<AgentCapability>`
specialization — exposed on the `sdk` public entrypoint, consuming
`prov-04-s1-execution-host-port/WorkerHandle` and `prov-00-s1-capability-attestation/CapabilityAttestation`
without redeclaring them, plus the evidence pack.

## Evidence pack

- Test name or artifact proving each AC (catalogued above).
- Test name or artifact proving each failure/degraded row (one negative fixture per `AgentFailureReason`
  token).
- Negative fixture for every rejection: `agent-capability-unattested.fixture.ts` …
  `agent-terminal-ambiguous.fixture.ts` (10 tokens), plus the type-level "missing required field"
  fixtures for representative DTOs (e.g. `ToolObserved.outputRef`, `AgentSession.hostWorkerHandleId`) and
  the non-`WorkerHandle` `hostWorker` fixture.
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Coverage command, instrumented lane, and number for the stated helper scope.
- Public-import test result for every exposed shape, imported through the `sdk` entrypoint.
- Forbidden-symbol sweep: the exact command above, path root, forbidden-token set, and zero-match output,
  captured.
- Conformance evidence is recorded/in-memory only (type-level and constructed fixtures); no real Codex
  client, MCP/app-server runtime, process, network, or credential — real driver attestation is Epic 6.

## Boundaries and STOP conditions

- Package or module boundary: `packages/sdk/src/providers/agent` only.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/providers/agent/**`, `packages/sdk/tests/providers/agent/**`.
- Forbidden dependencies: no `testkit`, no `provider-*`, no `cli`/`mcp`, no concrete Codex client /
  MCP-server / app-server runtime / network client / `execa` / `child_process`; do not redeclare
  `CapabilityAttestation` (owned by `prov-00-s1-capability-attestation`) or `WorkerHandle` (owned by
  `prov-04-s1-execution-host-port`).
- STOP when: a requirement needs real Codex protocol handling, real approval relay, real session resume,
  or a live probe (Epic 6 Codex driver); needs the mock Agent provider or conformance helpers
  (`prov-01-s2-agent-testkit`); needs the freshness-gate evaluation or run-log event-id assignment
  (Epic 3 core); or needs an agent shape the `provider-ports.md` design does not name.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 2 - stories](./README.md) · **← Prev:** [prov-00-s1-capability-attestation - shared capability attestation payload implementation story](./prov-00-s1-capability-attestation.md) · **Next →:** [prov-01-s2-agent-testkit - testkit mock Agent provider and conformance implementation story](./prov-01-s2-agent-testkit.md)

<!-- /DOCS-NAV -->
