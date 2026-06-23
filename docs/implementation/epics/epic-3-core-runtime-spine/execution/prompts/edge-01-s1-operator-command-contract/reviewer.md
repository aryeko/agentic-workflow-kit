# Reviewer Prompt: edge-01-s1-operator-command-contract

## Assigned Routing

- Source story id: `edge-01-s1-operator-command-contract`.
- Source AC ids: `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`.
- Model class: `frontier-reviewer`.
- Effort: `high`.
- Suggested-tier floor: `elevated`.
- Reasoning tier: `elevated`.
- Routing rationale: edge-01-s1-operator-command-contract covers AC-1, AC-2, AC-3, AC-4, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11 and carries public Edge command-envelope contract and explicit later-epic boundary exclusions. The selected tier is at or above the DAG floor and uses no provider-specific runtime model id.

## Original Scope

- Story id: `edge-01-s1-operator-command-contract`.
- Epic slug: `epic-3-core-runtime-spine`.
- Source story contract path: `docs/implementation/epics/epic-3-core-runtime-spine/stories/edge-01-s1-operator-command-contract.md`.
- Allowed pathset: `packages/sdk/src/edge/operator-command/**`, `packages/sdk/tests/edge/operator-command/**`.
- Direct dependencies: `core-01-s1-event-contracts`.
- Dependency inputs: `{{DEPENDENCY_COMMITS}}` plus committed producer shapes and public import paths named in the source contract and DAG.

### Acceptance Criteria

Each AC is a single assertion that is true or false against a type-level construction fixture or a
public-import test. As a type-only contract story, each "rejection" is a compilation failure proven by
its own negative fixture (a value omitting a required field or using a wrong literal/return type fails
`tsc`); a green `tsc -b` proves only acceptance. The `evidence` names the exact test id and the result.

- **AC-1** `OperatorSurface` has exactly the three members `"mcp" | "cli" | "external-trigger"`, and
  `OperatorActionKind` has exactly the 11 members `"preview-run" | "start-run" | "inspect-run" |
  "wait-run" | "approval-decision" | "stop-run" | "handoff-run" | "override-field" | "request-recovery" |
  "explain" | "attention-ack"` - evidence: `operator-unions.unit.test.ts` runs an exhaustiveness
  `switch` (a `never` check) over each union, and the negative fixture
  `operator-action-kind-unknown.fixture.ts` adding a 12th `OperatorActionKind` member (and a fixture
  adding a 4th `OperatorSurface`) fails the `never` check / compilation.
- **AC-2** `OperatorActorRef` is the union of `OsUserOperatorActorRef`
  (`kind: "os-user"`, `username`, optional `uid`/`gid`/`groups`, `hostname`, `processId`, optional
  `terminalRef`, `surfaceClient: "mcp" | "cli"`, `resolvedAt`,
  `identityConfidence: "verified-os" | "unverified"`), `UnavailableOsUserOperatorActorRef`
  (`kind: "os-user-unavailable"`, `hostname`, `processId`, optional `terminalRef`,
  `surfaceClient: "mcp" | "cli"`, `resolvedAt`,
  `failureReason: "lookup-failed" | "permission-denied" | "ambiguous"`,
  `identityConfidence: "unverified"`), and `DeferredExternalTriggerActorRef`
  (`kind: "external-trigger"`, `principalRef`, optional `authEvidenceRef`, `resolvedAt`,
  `identityConfidence: "unverified"`), each with `schema: "kit-vnext.operator-actor.v1"`, narrowable by
  `kind` - evidence: `operator-actor.unit.test.ts` narrows all three arms in a `switch` on `kind`, and
  the negative fixture `operator-actor-bad-schema.fixture.ts` using a `schema` other than
  `"kit-vnext.operator-actor.v1"` (and `operator-actor-os-user-missing-username.fixture.ts` omitting
  `username` on the `os-user` arm) fails compilation.
- **AC-3** `OperatorCommandTarget` has exactly the five optional fields `runId?`, `taskId?`, `trackId?`,
  `approvalRequestId?`, `attentionId?` (all `string`) and no required field - evidence:
  `operator-target.unit.test.ts` constructs an empty `{}` target and a fully-populated target, and the
  negative fixture `operator-target-unknown-field.fixture.ts` adding a sixth field under
  `exactOptionalPropertyTypes`/excess-property checking fails compilation.
- **AC-4** `OperatorCommandEnvelope<TParams>` is present with `schema: "kit-vnext.operator-command.v1"`,
  `actionId`, `actionKind: OperatorActionKind`, `commandName`, `surface: OperatorSurface`,
  `actor: OperatorActorRef`, `target: OperatorCommandTarget`, `params: TParams`, `paramsDigest: string`,
  `idempotencyKey: string`, `requestedAt: string`, optional `reason`/`correlationId`/`dryRun`, and
  optional `envelopeErrors?: OperatorEnvelopeError[]` - evidence:
  `operator-envelope.unit.test.ts` constructs an `OperatorCommandEnvelope<PreviewRunParams>` from a
  valid fixture, and the negative fixtures `operator-envelope-bad-schema.fixture.ts` (a `schema` other
  than `"kit-vnext.operator-command.v1"`) and `operator-envelope-missing-params-digest.fixture.ts`
  (omitting `paramsDigest`) fail compilation.
- **AC-5** `OperatorEnvelopeErrorCode` has exactly the five members `"params-invalid" | "target-invalid" |
  "idempotency-invalid" | "identity-unavailable" | "params-digest-unavailable"`, and `OperatorEnvelopeError`
  carries `code: OperatorEnvelopeErrorCode`, optional `field`, and `message` - evidence:
  `operator-envelope-error.unit.test.ts` runs an exhaustiveness `never` switch over
  `OperatorEnvelopeErrorCode` (one fixture per token asserting it is a constructible
  `OperatorEnvelopeError.code`), and the negative fixture `operator-envelope-error-unknown-code.fixture.ts`
  using a non-member `code` literal fails compilation.
- **AC-6** `OperatorCommandStatus` has exactly the four members `"completed" | "accepted" | "rejected" |
  "deferred"`; `OperatorEventRef` carries `eventId`, `sequence`, `payloadDigest`, and the literal
  `type: "OperatorActionRecorded"`; `OperatorCommandError` carries `code`, `message`, and
  `evidenceRefs: OperatorEventRef[]` - evidence: `operator-response-refs.unit.test.ts` runs a `never`
  switch over `OperatorCommandStatus` and constructs `OperatorEventRef`/`OperatorCommandError`, and the
  negative fixture `operator-event-ref-bad-type.fixture.ts` using a `type` other than
  `"OperatorActionRecorded"` (proving it is distinct from `core-01-s1/EvidenceEventRef`) fails
  compilation.
- **AC-7** `OperatorCommandResult<TView>` is present with `schema: "kit-vnext.operator-command-result.v1"`,
  `actionId`, `status: OperatorCommandStatus`, optional `operatorEventRef?: OperatorEventRef`, optional
  `runId?`, optional `cursor?: RunEventCursor` (the type cited from `core-01-s1-event-contracts`),
  optional `view?: TView`, and `errors: OperatorCommandError[]`; it declares NO `attention?`/`explanation?`
  fields (Epic-7-deferred) - evidence: `operator-result.unit.test.ts` constructs an
  `OperatorCommandResult<PreviewRunView>` whose `cursor` is a `core-01-s1/RunEventCursor` value, and the
  negative fixtures `operator-result-missing-errors.fixture.ts` (omitting the required `errors` array)
  and `operator-result-attention-field.fixture.ts` (adding an `attention` property, asserted rejected as
  excess) fail compilation.
- **AC-8** The three param/view pairs are present at the design's intent-level shape:
  `PreviewRunParams` (Work Source selector, track/task filters, profile name, `dryRun: true`) /
  `PreviewRunView`; `StartRunParams` (Work Source selector, track/task id or "next eligible", profile
  name, optional concurrency/idempotency keys) / `RunStartedView`; `InspectRunParams` (run id, view
  selectors `"state" | "events" | "approvals" | "gates" | "analysis"`, cursor, limit) /
  `RunInspectionView` - evidence: `operator-params-views.unit.test.ts` constructs each of the three
  params and three views from a valid fixture, and the negative fixture
  `inspect-params-bad-view-selector.fixture.ts` using a view selector outside
  `state|events|approvals|gates|analysis` fails compilation.
- **AC-9** `OperatorActionRecordedPayload` is present with `schema: "kit-vnext.operator-action-recorded.v1"`,
  `actionId`, `actionKind: OperatorActionKind`, `commandName`, `surface: OperatorSurface`,
  `actor: OperatorActorRef`, `target: OperatorCommandTarget`, `paramsDigest`, `idempotencyKey`,
  `requestedAt`, `acceptedAt`, optional `reasonDigest`,
  `resultIntent: "read" | "mutate" | "reject" | "defer"`, optional
  `envelopeErrors?: OperatorEnvelopeError[]`, and NO `approvalDecision`/`override` sub-blocks
  (Epic-7-deferred) - evidence: `operator-audit-payload.unit.test.ts` constructs the payload from a
  valid fixture and runs a `never` switch over `resultIntent`, and the negative fixtures
  `operator-audit-payload-bad-result-intent.fixture.ts` (a `resultIntent` outside
  `read|mutate|reject|defer`) and `operator-audit-payload-approval-block.fixture.ts` (adding an
  `approvalDecision` property, asserted rejected as excess) fail compilation.
- **AC-10** Every manifest shape — `OperatorSurface`, `OperatorActionKind`, `OperatorActorRef` (+ 3
  members), `OperatorCommandTarget`, `OperatorCommandEnvelope`, `OperatorEnvelopeErrorCode`,
  `OperatorEnvelopeError`, `OperatorCommandStatus`, `OperatorEventRef`, `OperatorCommandError`,
  `OperatorCommandResult`, `PreviewRunParams`/`PreviewRunView`, `StartRunParams`/`RunStartedView`,
  `InspectRunParams`/`RunInspectionView`, and `OperatorActionRecordedPayload` — is importable from the
  `sdk` package public entrypoint (not a private module path), per
  `epic0-s4-export-templates/PackageExportConvention` - evidence:
  `operator-command-public-import.unit.test.ts` imports every shape from the `sdk` entrypoint and
  constructs one conforming `OperatorCommandEnvelope<PreviewRunParams>` and one
  `OperatorCommandResult<PreviewRunView>` fixture.
- **AC-11** The contract source is type-only and self-contained — it declares no `OperatorControlPort`,
  no envelope-building/transport/identity-resolution runtime, imports no `cli`/`mcp`/`testkit`/driver/
  process/network client, references no later-epic type (`PolicyGrantScope`, `AttentionNotice`,
  `ExplanationView`, or any approval/recovery param/view), and does not redeclare
  `core-01-s1/RunEventCursor` or `core-01-s1/EvidenceEventRef` - evidence: the forbidden-symbol sweep
  below over `packages/sdk/src/edge/operator-command/` reports zero matches (exit code 1, no lines),
  captured into the evidence pack.

### Dependencies And Frozen Inputs

- Covers signals: "CLI and MCP command parity over the shared operator command envelope
  (envelope-substrate part)" — the type-only substrate part of the single edge-01 Epic-3 signal; the
  executable-smoke part is `edge-01-s2`.
- Depends on: `core-01-s1-event-contracts` (band 1).
- Depended on by: `edge-01-s2-cli-mcp-parity-smoke` (Epic 3); Epic 7 operator-production stories.
- Shared shapes consumed (cited verbatim, not redeclared):
  `core-01-s1-event-contracts/RunEventCursor` (the `OperatorCommandResult.cursor?` field type),
  `core-01-s1-event-contracts/EvidenceEventRef` (the sibling evidence ref this story's `OperatorEventRef`
  is explicitly distinct from).

Name exact producer/consumer shapes. Do not write "the fields supplied by X."

### Non-Goals

- `OperatorControlPort` (the full 11-method interface) — **deferred to Epic 7** by story-DAG scope
  decision 3, because its `decideApproval`/`requestRecovery`/`explain`/etc. param+view types reference
  types owned by later epics (approval → core-03/Epic 4; recovery → core-06/Epic 5). Epic 3 declaring
  it would depend on types that do not yet exist. The `edge-01-s2` smoke calls a structural three-method
  fake port, not a named SDK interface.
- The other 8 param/view pairs (`WaitRunParams`/`WaitRunView`, `ApprovalDecisionParams`/
  `ApprovalDecisionView`, `StopRunParams`/`StopRunView`, `HandoffRunParams`/`HandoffRunView`,
  `OverrideFieldParams`/`OverrideFieldView`, `RecoveryRequestParams`/`RecoveryPlanView`,
  `ExplainParams`/`ExplanationView`, `AttentionAckParams`/`AttentionAckView`) — **deferred to Epic 7**;
  they carry later-epic types (e.g. `ApprovalDecisionParams.requestedScope: PolicyGrantScope` from
  core-03, recovery params from core-06). This story declares only the preview/start/inspect three.
- `OperatorCommandResult.attention?: AttentionNotice[]` and `explanation?: ExplanationView` —
  **deferred to Epic 7**; `AttentionNotice`/`ExplanationView` are owned by the edge-01
  attention/explainability signal (`attention-explainability-and-triggers.md`), not the
  command-envelope signal this story covers. The two optional fields are omitted here and added by the
  Epic 7 operator-production story that owns that surface.
- `OperatorActionRecordedPayload.approvalDecision` (whose `requestedScope?: PolicyGrantScope` resolves
  to core-03/Epic 4) and `OperatorActionRecordedPayload.override` (a later-epic override-action
  concern) — **deferred to Epic 7**. This story declares the payload's core audit fields and omits both
  optional sub-blocks; `PolicyGrantScope` is not invented here.
- The mock-backed executable smoke — CLI/MCP envelope builders, the testkit structural fake control
  surface, byte-identical-envelope and one-audit-event proofs — owned by `edge-01-s2-cli-mcp-parity-smoke`.
- Real OS-user identity resolution, transport parsing, idempotency-key/`paramsDigest` computation, and
  any control-plane behavior — owned by the smoke (`edge-01-s2`) and Epic 7 production; this story
  declares the types those behaviors populate, not the behaviors.
- `core-01` run-log shapes (`RunEventCursor`, `EvidenceEventRef`) — owned by
  `core-01-s1-event-contracts`; referenced as shared shapes, never redeclared.

### STOP Conditions And Boundaries

- Package or module boundary: `packages/sdk/src/edge/operator-command` only.
- Owned pathset (globs the implementer may create or modify; the orchestrator commits strictly this):
  `packages/sdk/src/edge/operator-command/**`, `packages/sdk/tests/edge/operator-command/**`.
- Forbidden dependencies: no `testkit`, no `provider-*`, no `cli`/`mcp`, no driver / network client /
  `execa` / `child_process`; do not redeclare `core-01-s1/RunEventCursor` or `EvidenceEventRef` (owned
  by `core-01-s1-event-contracts`); do not reference any later-epic type (`PolicyGrantScope`,
  `AttentionNotice`, `ExplanationView`, or any approval/recovery param/view); do not declare
  `OperatorControlPort` (Epic 7).
- STOP when: a requirement needs `OperatorControlPort` or any of the 8 deferred param/view pairs (Epic 7);
  the `attention?`/`explanation?` result fields or their `AttentionNotice`/`ExplanationView` types (the
  edge-01 attention/explainability signal, Epic 7); the `approvalDecision`/`override` audit sub-blocks or
  `PolicyGrantScope` (core-03/Epic 4); the executable envelope-building/parity smoke
  (`edge-01-s2-cli-mcp-parity-smoke`); real OS-user identity resolution, transport parsing, or
  `paramsDigest`/`idempotencyKey` computation (the smoke / Epic 7 production); or an operator-surface
  shape the `command-surface-and-envelopes.md` design does not name.

## Runtime Slots

- `{{IMPLEMENTER_SUMMARY}}`
- `{{CHANGED_FILES}}`
- `{{DIFF}}`
- `{{TARGETED_CHECK_OUTPUT}}`
- `{{PNPM_CHECK_OUTPUT}}`
- `{{EVIDENCE_PACK}}`
- `{{DEPENDENCY_COMMITS}}`

## Review Checklist

Check implementation against source story `docs/implementation/epics/epic-3-core-runtime-spine/stories/edge-01-s1-operator-command-contract.md` and AC ids `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`, `AC-11`.

- AC coverage by source `AC-n` id, including every failure, degraded, validation, and negative-fixture row named by the source contract.
- Evidence pack completeness against the source `Quality bar` and `Evidence pack` sections.
- Public API names, exports, and import paths against the source contract and DAG producer/consumer table.
- Dependency boundaries, committed dependency inputs, and `{{DEPENDENCY_COMMITS}}` consistency.
- Stale names and sibling occurrences of any issue found.
- Tests, targeted checks, coverage commands, forbidden-symbol sweeps, and `pnpm check` output.
- Scope control against allowed writes: `packages/sdk/src/edge/operator-command/**`, `packages/sdk/tests/edge/operator-command/**`.
- Repo conventions and mutation limits from `AGENTS.md` and the source contract.

## Verdict Format

Return `APPROVED` only when no blocking findings remain. Otherwise return severity-ordered findings. For each finding, include file and line reference, required fix, and the source `AC-n` or boundary violated.

## Mutation Limits

No staging, commits, pushes, PRs, merges, worker closure, tracker edits, package edits, source planning edits, or writes outside the allowed pathset. The reviewer only inspects the implementation against the original story and returns a verdict.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - Core runtime spine](../../../README.md) · **← Prev:** [Implementer Prompt: edge-01-s1-operator-command-contract](./implementer.md) · **Next →:** [Implementer Prompt: edge-01-s2-cli-mcp-parity-smoke](../edge-01-s2-cli-mcp-parity-smoke/implementer.md)

<!-- /DOCS-NAV -->
