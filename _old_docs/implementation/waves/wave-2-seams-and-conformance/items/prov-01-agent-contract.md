---
title: "prov-01 — Agent contract + mock — implementation charter"
id: "prov-01-contract"
wave: 2
layer: "contracts (providers)"
status: "item: ready"
spec: "docs/design/domains/providers/prov-01-agent-execution/ (README.md + contracts-and-conformance.md + capabilities-and-conformance.md + mock-driver.md)"
---

# prov-01 — Agent contract + mock

**Purpose.** The seam for the rented worker: the model/session protocol, approval relay, structured
tool-exit, and normalized progress events — plus a mock agent. Contract + mock only; the real Codex
driver is the driver track. (FR-3/FR-4/FR-5, AD-12.)

**Spec (normative).** Implement the contract + capability set from
`docs/design/domains/providers/prov-01-agent-execution/`. Normalized event shapes, the approval-relay
protocol, and structured tool-exit are normative. Ambiguous → STOP and surface.

> **Spec reconciliation done** — the three return types (`AgentResumeRequest`, `ApprovalAnswerResult`, `AgentReleaseResult`) are now defined in the agent `contracts-and-conformance.md` (Q1 closed). Remaining open questions are non-blocking.

## Spec surface (manifest)

- **`AgentDriver`** interface — `probeCapabilities`, `startWorker`, `observe`, `answerApproval`,
  `resumeOwned`, `stopObserving`.
- **`AgentEvent`** union (discriminant `type`): `linked`, `progress`, `approval-requested`,
  `tool-observed`, `guardian-review`, `degraded`, `terminal`.
- **Defined types** — `AgentStartRequest` (incl. `hostWorker: WorkerHandle`), `AgentSession` (incl.
  `hostWorkerHandleId`, `ownershipClass`), `ToolObserved`, `AgentApprovalRequest`,
  `ApprovalAnswerChannel`, `ApprovalAnswer`, `ScopedGrant`.
- **Capability set** — `canRelayApproval`, `canPersistApprovalAnswerChannel`, `canResumeOwned`,
  `emitsStructuredToolExit`, `emitsGuardianReview`, `preservesHostProcessParentage`. Attestation = w2-1
  `CapabilityAttestation`.
- **Failure tokens (`AgentFailureReason`, owned here)** — `agent-capability-unattested`,
  `agent-linkage-lost`, `approval-relay-unattested`, `approval-answer-channel-lost`,
  `agent-resume-unattested`, `structured-tool-exit-missing`, `tool-output-ref-missing`,
  `guardian-review-untrusted`, `host-parentage-unproven`, `agent-terminal-ambiguous`.
- **Defined in `contracts-and-conformance.md`:** `AgentResumeRequest`, `ApprovalAnswerResult`,
  `AgentReleaseResult`.

## Responsibilities (in scope)

- The Agent contract + the six-member capability set.
- A **mock agent** with adversarial cases (omits progress, delays, lies about tool-exit, silent on
  approval, drops the answer channel, lost linkage) + conformance cases.

## Out of scope

*Where* the worker runs (prov-04 — referenced, not implemented); the real Codex app-server driver
(driver track); approval *adjudication* (core-03).

## Requirements owned

FR-3/FR-4/FR-5 (contract sides); NFR-EXT, NFR-TEST; **plus full prov-01 contract spec compliance.**

## Dependencies & frozen contracts

**Consumes (R5):** prov-04's `WorkerHandle`, cited verbatim as `AgentStartRequest.hostWorker:
WorkerHandle` (defined in prov-04 `contracts-and-conformance.md`). Depends on `fnd-04` (scoped creds,
via the driver at runtime), `w2-1`. Consumed by core-02/03/04/06. Must NOT depend on core/edge/drivers/SDK.

## Libraries

`zod`, `conformance-kit`, `fast-check`. **No Codex SDK / app-server, no real process** (driver track).

## Acceptance criteria (the shared rubric — defined surface only)

- **AC-1** `startWorker` requires `request.hostWorker` to be a `WorkerHandle`; a missing/wrong-typed
  handle returns `AgentFailure{ reason: "agent-capability-unattested" }` with no session created. — *contracts (`AgentStartRequest`).*
- **AC-2** `probeCapabilities` returns a `CapabilityAttestation[]` enumerating all six `AgentCapability`
  tokens; each has the full attestation field set; both `positive` and `negative` results are emittable. — *capabilities-and-conformance.md.*
- **AC-3** Over a session lifetime, `observe` emits **at most one** `linked` and **exactly one**
  `terminal` event; a duplicate/contradictory stream emits `agent-terminal-ambiguous`. — *capabilities-and-conformance.md (event invariants).*
- **AC-4** A `tool-observed` event has `tool.exitCode` (number), `tool.outputRef` (fnd-02 ref),
  `tool.outputDigest`, `tool.source === "agent"`; null exit → `degraded` with
  `structured-tool-exit-missing`; missing ref → `degraded` with `tool-output-ref-missing`; no
  `tool-observed` is emitted in either case. — *capabilities; README §8.*
- **AC-5** A `progress` event carries `sessionId` and `at` (optionally `message`/`itemId`); provider-raw
  text appears only inside `message`. — *contracts (`AgentEvent`).*
- **AC-6** When `canRelayApproval` is negative/absent and a provider approval arrives, the result is a
  `degraded` event with `approval-relay-unattested` and the run parks — **no synthetic answer** is sent. — *capabilities; README §8.*
- **AC-7** `answerApproval(session, answer)` with `answer.requestId` matching the observed
  `approval-requested` routes the `ScopedGrant` through the `ApprovalAnswerChannel` and emits an
  `AgentApprovalAnswered` log event; it fabricates no provider response. *(Asserts behavior + the
  emitted event; `ApprovalAnswerResult` return shape is defined in `contracts-and-conformance.md`.)* — *contracts; README §4.*
- **AC-8** The mock can attest a capability `positive` yet not deliver the signal, and the capability
  gate still fails closed with the correct `AgentFailureReason` (property test across all six
  capabilities). — *mock-driver.md ("it can lie … and Capability & Safety still fails closed").*
- **AC-9** `AgentCapabilityAttested`, `AgentSessionLinked`, and a single `AgentSessionTerminal` log
  event are emitted at the corresponding stream points. — *README §6.*
- **AC-10** No Codex SDK / app-server / `child_process` import in the contract or mock package
  (depcruise + grep). — *charter Libraries; dependency-policy.md.*
- **AC-11** `resumeOwned` requires fresh `canResumeOwned` and otherwise returns
  `agent-resume-unattested`; `stopObserving` returns its release result. *(`AgentResumeRequest` and
  `AgentReleaseResult` are now defined in `contracts-and-conformance.md`.)*

## Failure & degraded outcomes (first-class)

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `approval-relay-unattested` | approval arrives; `canRelayApproval` absent/stale/negative | park; `degraded`; never a synthetic answer | AC-6 |
| `approval-answer-channel-lost` | answer undeliverable after park/resume (channel not `persistable`) | record lost channel; remain parked; require operator recovery | AC-7 (adversarial `dropped-approval`) |
| `structured-tool-exit-missing` | command item with null/absent `exitCode` | `degraded`; no `tool-observed` | AC-4 |
| `tool-output-ref-missing` | output exists but no `outputRef` / redaction fails | `degraded`; never embed raw output | AC-4 |
| `agent-linkage-lost` | no stable `linked` / `providerSessionId` changes mid-run | `degraded`; no resume/answer proceeds | AC-3 |
| `agent-terminal-ambiguous` | provider ends without one classified terminal reason | single `terminal` (`provider-lost`) or `degraded`; never multiple terminals | AC-3 |
| `agent-resume-unattested` | `resumeOwned` without fresh `canResumeOwned` | `AgentFailure` (deferred shape) | AC-11 |
| `agent-capability-unattested` | `startWorker` with bad handle / stale attestation | `AgentFailure`; no session | AC-1 |
| `host-parentage-unproven` | `preservesHostProcessParentage` not attested | kill-dependent autonomy off; attestation negative | AC-2 |
| `guardian-review-untrusted` | Guardian payload missing/unstable/unattested | advisory only; no gate-bearing `guardian-review` | AC-2 (negative path) |

## Quality bar

- Coverage ≥ 90% lines/branches (aim 95%), enforced by
  `vitest run --coverage --coverage.thresholds.lines=90 --coverage.thresholds.branches=90` (paste it).
- Required tests (catalogue): the named mock fixtures `dropped-approval`, `lost-linkage`, `no-exit-code`,
  `claim-without-evidence`, duplicate-`linked`, duplicate-`terminal`, `source!=="agent"`,
  raw-output-no-ref, stale-attestation, `observe-only`+parentage; the lie-and-fail-closed property
  (AC-8); the no-SDK depcruise lane.
- File ≤ 800 lines; clock/id injected; no SDK.

## Required reading

This domain's spec (`README.md` + `contracts-and-conformance.md` + `capabilities-and-conformance.md` +
`mock-driver.md`); prov-04's `WorkerHandle`; `decisions.md` AD-12; `dependency-policy.md`;
`testing-policy.md`; `w2-1`. Nothing else.

## Deliverable

The Agent contract package + mock agent, passing the conformance kit; the evidence pack
(test-per-AC, coverage, depcruise). The three previously-blocked types (`AgentResumeRequest`,
`ApprovalAnswerResult`, `AgentReleaseResult`) are now defined in the spec (`contracts-and-conformance.md`).

## Boundaries

Contract + mock only; references prov-04's `WorkerHandle`, never a real host. If the agent/host boundary
is ambiguous, **STOP and surface** (don't fold host concerns into the agent seam).

## Open questions (non-blocking; tracked)

- **Q1 — RESOLVED.** `AgentResumeRequest` (input to `resumeOwned`), `ApprovalAnswerResult` (return of
  `answerApproval`), and `AgentReleaseResult` (return of `stopObserving`) are now defined in
  `docs/design/domains/providers/prov-01-agent-execution/contracts-and-conformance.md`. AC-7/AC-11 unblocked.
- **Q2.** Which `ownershipClass` values are valid for `startWorker` vs `resumeOwned`? (approval relay +
  parentage gate on it.)
- **Q3.** How is `ApprovalAnswerChannel.persistable` set by the mock — scenario config, or derived from
  the `canPersistApprovalAnswerChannel` attestation?
- **Q4.** `emitsStructuredToolExit` collides with prov-04's same-named Host capability; the spec says
  consumers qualify via core-02 `AttestationRef.provider`. Contracts can't import that core type — note
  the distinction; resolve in a core wave.
- **Q5.** The test-clock injection shape for deterministic mock replay (`atMs`) is not typed in the spec.
- **Q6.** Conformance-suite items "real-driver smoke" and "parentage probe" are unpassable for the mock
  — confirm they are `skip` (not `fail`) in the `conformance-mock` lane.
