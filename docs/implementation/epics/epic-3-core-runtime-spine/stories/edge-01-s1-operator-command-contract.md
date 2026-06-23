---
title: "edge-01-s1-operator-command-contract - shared operator command-envelope substrate implementation story"
id: "edge-01-s1-operator-command-contract"
epic: 3
status: "story: ready"
design:
  - "docs/design/30-domain-reference/edge/operator-surface/command-surface-and-envelopes.md"
  - "docs/design/30-domain-reference/edge/operator-surface/README.md"
---

# edge-01-s1-operator-command-contract - Shared Operator Command-Envelope Substrate

## Purpose

Declare the host-neutral, type-only operator command-envelope substrate in the SDK — the request
envelope, action/actor/target/error/event-ref/result types, and the preview/start/inspect param+view
pairs — as the single shared producer that the `edge-01-s2` mock-backed parity smoke (and Epic 7's
operator-production stories) import and never redeclare (FR-10, the Operator side of FR-4, NFR-OBS,
NFR-SAFE; story-DAG scope decision 3). It declares **only** fields whose types resolve from `core-01`
or `edge-01` itself; it does **not** declare `OperatorControlPort` (Epic 7 owns the full interface).

## Normative design

- `docs/design/30-domain-reference/edge/operator-surface/command-surface-and-envelopes.md` — THE
  envelope catalog: §Command parity (the 11-value `OperatorActionKind` ↔ MCP/CLI ↔ control-plane-call
  ↔ audit-event mapping, and the parity contract that MCP and CLI build the same envelope bytes
  except `surface`/`surfaceClient`/terminal-process fields/`requestedAt`); §Request envelope
  (`OperatorSurface`, `OperatorActionKind`, the `OperatorActorRef` union + 3 members,
  `OperatorCommandTarget`, `OperatorCommandEnvelope<TParams>` with `paramsDigest`/`idempotencyKey`/
  `envelopeErrors?`, `OperatorEnvelopeErrorCode`, `OperatorEnvelopeError`, and the `paramsDigest` =
  canonical digest of REDACTED params rule); §Response envelope (`OperatorCommandStatus`,
  `OperatorEventRef` as the local audit ref distinct from `EvidenceEventRef`, `OperatorCommandError`,
  `OperatorCommandResult<TView>`); §Operator audit payload (`OperatorActionRecordedPayload`);
  §Command parameters (the `PreviewRunParams`/`StartRunParams`/`InspectRunParams` intent-level shapes).
- `docs/design/30-domain-reference/edge/operator-surface/README.md` §4–§6 — the one-call/one-audit-event
  mapping, the edge-emits-no-events / never-obtains-a-`RunWriter` boundary, the "edge performs only
  transport parsing needed to build the envelope" boundary, and the `OperatorActionRecorded` barrier
  durability note.
- `docs/implementation/epics/epic-3-core-runtime-spine/story-dag.md` §Epic-specific scope decisions
  item 3 — the forward-dependency rule: declare only the self-contained substrate; do NOT declare
  `OperatorControlPort`; record any field/type that resolves only to a later epic as **deferred to
  Epic 7**, never invent it.
- `docs/design/20-sdk-and-packaging/dependency-rules.md`, `sdk-boundary.md` — `sdk` may import only
  pure runtime libraries; no driver, process, network, `cli`, `mcp`, or `testkit` imports.
- `docs/implementation/epics/epic-0-implementation-substrate-and-guardrails/stories/epic0-s4-export-templates.md`
  — `PackageExportConvention` for the public `sdk` entrypoint (export + barrel + `exports`).
- `docs/engineering/test-lanes.md` — the hermetic `*.unit.test.ts` lane (zero process/network/filesystem).

If these sources do not answer a contract question, this story is not ready.

## Spec surface

What the normative design defines and the implementation must expose, by the design's exact names
(runtime-types variant). This story DECLARES all of these as host-neutral type-only contracts; it
implements no envelope-building or transport behavior (that is the `edge-01-s2` smoke). Distinct
design unions are kept distinct.

- Interfaces / types:
  - `OperatorCommandTarget` — the optional run/task/track/approval/attention reference bag
    (`runId?`, `taskId?`, `trackId?`, `approvalRequestId?`, `attentionId?`).
  - `OperatorCommandEnvelope<TParams>` — the request envelope with the `schema` literal
    `"kit-vnext.operator-command.v1"` and the fields `actionId`, `actionKind: OperatorActionKind`,
    `commandName`, `surface: OperatorSurface`, `actor: OperatorActorRef`, `target: OperatorCommandTarget`,
    `params: TParams`, `paramsDigest`, `idempotencyKey`, `requestedAt`, optional `reason`/`correlationId`/
    `dryRun`, and optional `envelopeErrors?: OperatorEnvelopeError[]`.
  - `OperatorCommandResult<TView>` — the response shape with the `schema` literal
    `"kit-vnext.operator-command-result.v1"` and the fields `actionId`, `status: OperatorCommandStatus`,
    optional `operatorEventRef?: OperatorEventRef`, optional `runId?`, optional
    `cursor?: RunEventCursor` (cited from `core-01-s1`), optional `view?: TView`, and
    `errors: OperatorCommandError[]`. The optional `attention?`/`explanation?` fields are **deferred to
    Epic 7** (their types reach a later edge-01 signal — see Out of scope).
  - `OperatorActorRef` (union) = `OsUserOperatorActorRef` | `UnavailableOsUserOperatorActorRef` |
    `DeferredExternalTriggerActorRef`, each with the `schema` literal `"kit-vnext.operator-actor.v1"`
    and the design fields (`kind` discriminant `"os-user"` | `"os-user-unavailable"` | `"external-trigger"`).
  - `OperatorEnvelopeError` — `code: OperatorEnvelopeErrorCode`, optional `field`, `message`.
  - `OperatorEventRef` — `eventId`, `sequence`, `payloadDigest`, `type: "OperatorActionRecorded"`
    (distinct from `core-01-s1/EvidenceEventRef`).
  - `OperatorCommandError` — `code`, `message`, `evidenceRefs: OperatorEventRef[]`.
  - Param/view pairs (the three this story owns): `PreviewRunParams`/`PreviewRunView`,
    `StartRunParams`/`RunStartedView`, `InspectRunParams`/`RunInspectionView`.
- Unions:
  - `OperatorSurface` — `"mcp" | "cli" | "external-trigger"`.
  - `OperatorActionKind` — the 11 members `"preview-run" | "start-run" | "inspect-run" | "wait-run" |
    "approval-decision" | "stop-run" | "handoff-run" | "override-field" | "request-recovery" |
    "explain" | "attention-ack"` (string literals only — safe to declare in full).
  - `OperatorCommandStatus` — `"completed" | "accepted" | "rejected" | "deferred"`.
  - `OperatorEnvelopeErrorCode` — the 5 members `"params-invalid" | "target-invalid" |
    "idempotency-invalid" | "identity-unavailable" | "params-digest-unavailable"`.
- Events / append intents:
  - `OperatorActionRecordedPayload` — the audit payload, declared as the Epic-3-feasible subset with
    the `schema` literal `"kit-vnext.operator-action-recorded.v1"` and the fields `actionId`,
    `actionKind: OperatorActionKind`, `commandName`, `surface: OperatorSurface`, `actor: OperatorActorRef`,
    `target: OperatorCommandTarget`, `paramsDigest`, `idempotencyKey`, `requestedAt`, `acceptedAt`,
    optional `reasonDigest`, `resultIntent: "read" | "mutate" | "reject" | "defer"`, and optional
    `envelopeErrors?: OperatorEnvelopeError[]`. The two optional action-specific sub-blocks
    `approvalDecision` (its `requestedScope?: PolicyGrantScope` resolves to core-03) and `override`
    (a later-epic override-action concern) are **deferred to Epic 7** — see Out of scope. The edge
    constructs envelope input but never writes this payload to the Event log (README §6).
- Failure and degraded tokens:
  - `OperatorEnvelopeErrorCode` members (5, above) — the envelope-validation token catalog this story
    OWNS; the `edge-01-s2` smoke and Epic 7 production raise them, this story declares them and proves
    each is a constructible `OperatorEnvelopeError.code`.
- Evidence records / attestations: none — the edge authors no events; the audit payload above is a
  declared type only, written by the Control plane (Epic 7), never by this contract.
- Shared shapes consumed (cited from the producer, NOT redeclared): `core-01-s1-event-contracts/RunEventCursor`
  (the `OperatorCommandResult.cursor?` field type) and `core-01-s1-event-contracts/EvidenceEventRef`
  (the sibling evidence ref `OperatorEventRef` is explicitly declared distinct from).

Done requires every item here present with the design's names, shapes, and semantics. Coverage is
type-level only: this story ships no runtime behavior, so there is no instrumented runtime helper lane;
each shape is proven by a type-level construction fixture (a value missing a field or with a wrong type
fails compilation) plus a public-import test (per the standard's substrate note on type-only stories).

## Responsibilities

- Declare `OperatorSurface` and `OperatorActionKind` (all 11 members) as closed unions with exactly the
  design's members and no others, kept distinct from each other.
- Declare the `OperatorActorRef` union and its three members (`OsUserOperatorActorRef`,
  `UnavailableOsUserOperatorActorRef`, `DeferredExternalTriggerActorRef`) with the design fields, the
  `schema` literal `"kit-vnext.operator-actor.v1"`, and the `kind` discriminant, narrowable by `kind`.
- Declare `OperatorCommandTarget` with the five optional reference fields and no others.
- Declare `OperatorCommandEnvelope<TParams>` with the design fields, the frozen `schema` literal
  `"kit-vnext.operator-command.v1"`, and the parity-load-bearing fields `paramsDigest`,
  `idempotencyKey`, and optional `envelopeErrors?`.
- Declare `OperatorEnvelopeErrorCode` (5 members) and `OperatorEnvelopeError` — the envelope-validation
  token catalog this story owns.
- Declare `OperatorCommandStatus` (4 members), `OperatorEventRef` (with the `type:
  "OperatorActionRecorded"` literal, distinct from `core-01-s1/EvidenceEventRef`), and
  `OperatorCommandError`.
- Declare `OperatorCommandResult<TView>` with the design fields and the frozen `schema` literal
  `"kit-vnext.operator-command-result.v1"`, consuming `core-01-s1-event-contracts/RunEventCursor` for
  `cursor?` without redeclaring it, and OMITTING the Epic-7-deferred `attention?`/`explanation?` fields.
- Declare the three param/view pairs (`PreviewRunParams`/`PreviewRunView`, `StartRunParams`/
  `RunStartedView`, `InspectRunParams`/`RunInspectionView`) at the design's intent-level, host-neutral
  shape.
- Declare `OperatorActionRecordedPayload` as the Epic-3-feasible subset (core audit fields), with the
  `schema` literal `"kit-vnext.operator-action-recorded.v1"` and `resultIntent`, omitting the
  later-epic `approvalDecision`/`override` sub-blocks.
- Export the full declared substrate from the `sdk` public entrypoint with no private-module imports,
  per `epic0-s4-export-templates/PackageExportConvention`.

## Out of scope

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

## Dependencies and frozen inputs

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

## Acceptance criteria

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

## Coverage matrix

Every responsibility and spec-surface item maps to a proving AC; every AC maps back to one. No
responsibility crosses this story's assigned signal.

| Responsibility / spec-surface item | Proven by |
|---|---|
| `OperatorSurface` (3) + `OperatorActionKind` (11) unions, kept distinct | AC-1 |
| `OperatorActorRef` union + 3 members (`schema`/`kind` discriminated) | AC-2 |
| `OperatorCommandTarget` (5 optional refs, no others) | AC-3 |
| `OperatorCommandEnvelope<TParams>` (incl. `schema` literal, `paramsDigest`, `idempotencyKey`, `envelopeErrors?`) | AC-4 |
| `OperatorEnvelopeErrorCode` (5 tokens) + `OperatorEnvelopeError` | AC-5 |
| `OperatorCommandStatus` (4) + `OperatorEventRef` (distinct from `EvidenceEventRef`) + `OperatorCommandError` | AC-6 |
| `OperatorCommandResult<TView>` (incl. `cursor?: RunEventCursor`; no `attention?`/`explanation?`) | AC-7 |
| 3 param/view pairs (preview/start/inspect) | AC-8 |
| `OperatorActionRecordedPayload` (Epic-3-feasible subset; no `approvalDecision`/`override`) | AC-9 |
| Public exposure of the full declared substrate | AC-10 |
| Type-only + self-contained (no `OperatorControlPort`, no runtime, no later-epic type, no redeclared shared shape) | AC-11 |

## Failure and degraded outcomes

Token catalog this story OWNS (`OperatorEnvelopeErrorCode`). As a type-only contract surface, each
row's "required behavior" is that the token is a declared, constructible member of the named catalog
(with the design's trigger recorded for the smoke/production that raises it); the cited AC asserts that
membership and rejects a non-member literal with its own negative fixture. The runtime trigger is
exercised by `edge-01-s2-cli-mcp-parity-smoke` and Epic 7 production, not here.

| token | trigger (design) | required behavior | proven by |
|---|---|---|---|
| `params-invalid` (`OperatorEnvelopeErrorCode`) | Transport-shape parse finds the command's params are not a well-formed `TParams`. | Declared in this catalog and constructible as `OperatorEnvelopeError.code`; a non-member literal is rejected by `operator-envelope-error-unknown-code.fixture.ts`. Raised by `edge-01-s2`/Epic 7. | AC-5 |
| `target-invalid` (`OperatorEnvelopeErrorCode`) | The `OperatorCommandTarget` references are malformed or inconsistent for the action. | Declared/constructible as `OperatorEnvelopeError.code`; non-member rejected. Raised by `edge-01-s2`/Epic 7. | AC-5 |
| `idempotency-invalid` (`OperatorEnvelopeErrorCode`) | The `idempotencyKey` is missing or malformed for an action that requires it. | Declared/constructible as `OperatorEnvelopeError.code`; non-member rejected. Raised by `edge-01-s2`/Epic 7. | AC-5 |
| `identity-unavailable` (`OperatorEnvelopeErrorCode`) | OS-user identity lookup failed, so the envelope carries an `os-user-unavailable` actor. | Declared/constructible as `OperatorEnvelopeError.code`; non-member rejected. Raised by `edge-01-s2`/Epic 7. | AC-5 |
| `params-digest-unavailable` (`OperatorEnvelopeErrorCode`) | The canonical redacted `paramsDigest` could not be produced for the command params. | Declared/constructible as `OperatorEnvelopeError.code`; non-member rejected. Raised by `edge-01-s2`/Epic 7. | AC-5 |

## Quality bar

- Coverage scope and threshold: this story is type-only — the manifest shapes are interfaces, type
  aliases, and unions with no runtime behavior, so there is **no instrumented runtime helper lane** for
  this story (per the standard's substrate/type-only note). Each shape is proven by the type-level
  construction fixtures in AC-1…AC-9 (a value missing a field or using a wrong literal fails `tsc`) and
  the public-import test in AC-10. Any incidental const fixture builders used by the tests carry no
  branching logic, so a line-coverage number would be vacuous; the gradable artifact is the compile-pass
  /compile-fail fixture pair per shape.
- Coverage command and instrumented lane(s): the type-level lane is enforced by `tsc -b` within
  `pnpm check`; focused per-story run via `pnpm exec vitest run --project unit --passWithNoTests
  packages/sdk/tests/edge/operator-command/*.unit.test.ts`. The negative fixtures are excluded from the
  build target and asserted to fail compilation by their own type-error tests (no runtime coverage
  number is claimed for this story).
- Required tests, catalogued by AC and failure row: `operator-unions.unit.test.ts` (AC-1);
  `operator-actor.unit.test.ts` (AC-2); `operator-target.unit.test.ts` (AC-3);
  `operator-envelope.unit.test.ts` (AC-4); `operator-envelope-error.unit.test.ts` with one fixture per
  `OperatorEnvelopeErrorCode` token (AC-5, all 5 failure rows); `operator-response-refs.unit.test.ts`
  (AC-6); `operator-result.unit.test.ts` (AC-7); `operator-params-views.unit.test.ts` (AC-8);
  `operator-audit-payload.unit.test.ts` (AC-9); `operator-command-public-import.unit.test.ts` (AC-10);
  the forbidden-symbol sweep (AC-11). Negative fixtures: `operator-action-kind-unknown.fixture.ts`,
  `operator-actor-bad-schema.fixture.ts`, `operator-actor-os-user-missing-username.fixture.ts`,
  `operator-target-unknown-field.fixture.ts`, `operator-envelope-bad-schema.fixture.ts`,
  `operator-envelope-missing-params-digest.fixture.ts`, `operator-envelope-error-unknown-code.fixture.ts`,
  `operator-event-ref-bad-type.fixture.ts`, `operator-result-missing-errors.fixture.ts`,
  `operator-result-attention-field.fixture.ts`, `inspect-params-bad-view-selector.fixture.ts`,
  `operator-audit-payload-bad-result-intent.fixture.ts`, `operator-audit-payload-approval-block.fixture.ts`.
- Public exposure (import path + public-import test): every manifest shape (`OperatorSurface`,
  `OperatorActionKind`, `OperatorActorRef`, `OsUserOperatorActorRef`, `UnavailableOsUserOperatorActorRef`,
  `DeferredExternalTriggerActorRef`, `OperatorCommandTarget`, `OperatorCommandEnvelope`,
  `OperatorEnvelopeErrorCode`, `OperatorEnvelopeError`, `OperatorCommandStatus`, `OperatorEventRef`,
  `OperatorCommandError`, `OperatorCommandResult`, `PreviewRunParams`, `PreviewRunView`, `StartRunParams`,
  `RunStartedView`, `InspectRunParams`, `RunInspectionView`, `OperatorActionRecordedPayload`) is exported
  from the `sdk` public entrypoint per `epic0-s4-export-templates/PackageExportConvention` (export +
  barrel + `exports`); proven by `operator-command-public-import.unit.test.ts` (AC-10).
- Determinism constraints: all shapes are pure type declarations; no clock, randomness, process, or I/O.
  All time fields (`requestedAt`, `resolvedAt`, `acceptedAt`) and digest fields (`paramsDigest`,
  `payloadDigest`, `reasonDigest`) are caller-supplied strings on the types; the contract never reads
  `Date.now`/`new Date`/`Math.random`/`crypto.randomUUID` (those belong to the injected clock/id/digest
  ports used by the `edge-01-s2` smoke and Epic 7 production).
- Dependency boundaries: `sdk` may import only pure runtime libraries; the contract source must not
  import `testkit`, any `provider-*`, `cli`, `mcp`, any driver, network client, `execa`, or
  `child_process` (`dependency-rules.md`). It references the shared `core-01-s1/RunEventCursor` (type
  position) only, never redeclaring it or `EvidenceEventRef`; it references no later-epic type.
- File-size budget (lines per file; default soft cap ~200): split into focused files, each ≤ 200 lines —
  e.g. `unions.ts` (`OperatorSurface`, `OperatorActionKind`, `OperatorCommandStatus`,
  `OperatorEnvelopeErrorCode`), `actor.ts` (`OperatorActorRef` + 3 members), `envelope.ts`
  (`OperatorCommandTarget`, `OperatorCommandEnvelope`, `OperatorEnvelopeError`), `result.ts`
  (`OperatorEventRef`, `OperatorCommandError`, `OperatorCommandResult`), `params-views.ts` (the three
  param/view pairs), `audit-payload.ts` (`OperatorActionRecordedPayload`), with a barrel re-export.
- Domain non-negotiables: the edge emits no Run events and never obtains a `RunWriter` (README §4, §6) —
  `OperatorActionRecordedPayload` is a declared type only, written by the Control plane, never by this
  contract or any edge code; every envelope uses the `OperatorCommandEnvelope` schema literal
  `"kit-vnext.operator-command.v1"` and every result the `OperatorCommandResult` literal
  `"kit-vnext.operator-command-result.v1"`; `paramsDigest` is a canonical digest of REDACTED params
  (no secrets, prompt text, raw command output, or provider response bodies in the envelope) and MCP/CLI
  produce the same envelope bytes for the same logical command except `surface`/`surfaceClient`/
  terminal-process fields/`requestedAt` (this is the contract the `edge-01-s2` smoke verifies);
  `OperatorEventRef` is kept distinct from `core-01-s1/EvidenceEventRef`; the unions are closed and
  fail-closed (an unknown `OperatorActionKind`/`OperatorEnvelopeErrorCode`/`resultIntent` is
  unrepresentable). This story declares the substrate type-only and implements no behavior; envelope
  building and the parity proof belong to `edge-01-s2`, and `OperatorControlPort` belongs to Epic 7.

### Forbidden-symbol sweep (runnable recipe)

```sh
grep -REn "execa|child_process|node:net|node:http|node:https|@octokit|net\\.connect|spawn\\(|new WebSocket|OperatorControlPort|PolicyGrantScope|AttentionNotice|ExplanationView|interface RunEventCursor|type RunEventCursor|interface EvidenceEventRef|type EvidenceEventRef|from \"@kit-vnext/cli|from \"@kit-vnext/mcp|from \"@kit-vnext/testkit" \
  packages/sdk/src/edge/operator-command/
```

- Path root: `packages/sdk/src/edge/operator-command/`.
- Forbidden-token set: `execa`, `child_process`, `node:net`, `node:http`, `node:https`, `@octokit`,
  `net.connect`, `spawn(`, `new WebSocket` (process/network leaks); `OperatorControlPort` (the Epic-7
  full interface must not appear here); `PolicyGrantScope`, `AttentionNotice`, `ExplanationView`
  (later-epic types this story must not reference); `type RunEventCursor`/`interface RunEventCursor` and
  the `EvidenceEventRef` variants (redeclaring a shared `core-01-s1` shape); `cli`/`mcp`/`testkit`
  package imports (forbidden dependency edges from `sdk`).
- Expected result: zero matches (exit code 1, no lines), captured into the evidence pack. A non-empty
  match means the substrate leaked a runtime implementation, the Epic-7 port, a later-epic type, a
  redeclared shared shape, or a forbidden dependency, and fails this story.

## Required reading

- `docs/design/30-domain-reference/edge/operator-surface/command-surface-and-envelopes.md` (the full
  envelope catalog — §Command parity, §Request envelope, §Response envelope, §Operator audit payload,
  §Command parameters).
- `docs/design/30-domain-reference/edge/operator-surface/README.md` §4–§6 (the one-call/one-audit-event
  mapping, the edge-emits-no-events / never-obtains-a-`RunWriter` boundary, the transport-parsing-only
  boundary).
- `docs/implementation/epics/epic-3-core-runtime-spine/story-dag.md` §Epic-specific scope decisions
  item 3 (the forward-dependency rule and the deferred-to-Epic-7 list).
- `docs/implementation/epics/epic-3-core-runtime-spine/stories/core-01-s1-event-contracts.md` (the
  producer of `RunEventCursor` and `EvidenceEventRef` cited here).
- `docs/design/20-sdk-and-packaging/dependency-rules.md`, `sdk-boundary.md`.
- `epic0-s4-export-templates` story contract (the `PackageExportConvention` for the public `sdk`
  entrypoint).
- `docs/engineering/test-lanes.md` (the hermetic `*.unit.test.ts` lane).

Do not require unrelated corpus-wide reading. If a contract is relevant, name it.

## Deliverable

The `packages/sdk` operator command-envelope substrate — `OperatorSurface`, `OperatorActionKind`, the
`OperatorActorRef` union + 3 members, `OperatorCommandTarget`, `OperatorCommandEnvelope<TParams>`, the
`OperatorEnvelopeErrorCode`/`OperatorEnvelopeError` token catalog, `OperatorCommandStatus`,
`OperatorEventRef`, `OperatorCommandError`, `OperatorCommandResult<TView>` (without the Epic-7-deferred
`attention?`/`explanation?` fields), the three preview/start/inspect param/view pairs, and
`OperatorActionRecordedPayload` (without the Epic-7-deferred `approvalDecision`/`override` sub-blocks) —
declared type-only, split into focused files, exposed on the `sdk` public entrypoint, consuming
`core-01-s1/RunEventCursor` without redeclaring it and declaring `OperatorEventRef` distinct from
`core-01-s1/EvidenceEventRef`, plus the evidence pack. It does NOT declare `OperatorControlPort`.

## Evidence pack

- Test name or artifact proving each AC (catalogued in the quality bar).
- Test name or artifact proving each failure/degraded row: `operator-envelope-error.unit.test.ts` (one
  fixture per `OperatorEnvelopeErrorCode` token, all 5 rows).
- Negative fixture for every rejection: the 13 `*.fixture.ts` files listed in the quality bar (each
  asserted to fail compilation), plus the per-token membership fixtures in AC-5.
- `pnpm check` result, unless blocked by a named unrelated repository issue.
- Type-level lane evidence: `tsc -b` passes for the conforming shapes; each negative fixture fails
  compilation (no runtime coverage number is claimed — this is a type-only story).
- Public-import test result for every exposed shape, imported through the `sdk` entrypoint
  (`operator-command-public-import.unit.test.ts`).
- Forbidden-symbol sweep: the exact command above, path root, forbidden-token set, and zero-match output,
  captured.
- Conformance/runtime evidence: none — this story ships no runtime behavior; no real process, network,
  filesystem, driver, identity resolver, or credential is used. Envelope-building parity is owned by
  `edge-01-s2-cli-mcp-parity-smoke`.

## Boundaries and STOP conditions

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

## Characterization Review

Architect-recorded review of this contract's load-bearing scope decisions. Each entry records
rationale, the design line it traces to, the falsification criterion, and the escalation path.

### Decision: operator-control-port-deferred-to-epic-7

- Rationale: the full named port references later-epic approval, recovery, attention, and explanation
  types, so Epic 3 can only declare the self-contained envelope substrate and preview/start/inspect
  subset.
- Design trace: `story-dag.md` scope decision `edge-01-command-substrate-only`;
  `docs/design/30-domain-reference/edge/operator-surface/command-surface-and-envelopes.md` (full
  `OperatorControlPort` surface).
- Falsification: this story declares `OperatorControlPort` or any later-epic param/view type.
- Escalation: if the subset cannot be declared without a later-epic type, raise a design-sequencing gap
  instead of inventing placeholders.

### Decision: eight-param-view-pairs-deferred

- Rationale: only preview/start/inspect are needed for Epic 3 parity; the remaining operator actions
  require later core domains and are therefore named deferrals.
- Design trace: `docs/design/30-domain-reference/edge/operator-surface/command-surface-and-envelopes.md`
  (11-method command table and later-epic param/view surfaces).
- Falsification: wait/approval/stop/handoff/override/recovery/explain/attention param or view types are
  declared here.
- Escalation: if parity smoke needs one of the deferred actions, move it to Epic 7 sequencing; do not
  expand this type-only substrate.

### Decision: operator-event-ref-distinct-from-evidence-event-ref

- Rationale: `OperatorEventRef` points to operator audit events, while core-01 `EvidenceEventRef` cites
  arbitrary recorded evidence; conflating them would erase provenance boundaries.
- Design trace: `docs/design/30-domain-reference/edge/operator-surface/command-surface-and-envelopes.md`
  (`OperatorEventRef` is distinct from core-01 `EvidenceEventRef`).
- Falsification: `OperatorEventRef` aliases `EvidenceEventRef`, or operator audit references are stored
  as generic evidence refs without the operator-event shape.
- Escalation: if a consumer needs both refs, carry both fields explicitly; do not collapse the types.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 - stories](./README.md) · **← Prev:** [core-07-s3-analysis-records-and-reports - analysis records and reports implementation story](./core-07-s3-analysis-records-and-reports.md) · **Next →:** [edge-01-s2-cli-mcp-parity-smoke - CLI and MCP parity smoke implementation story](./edge-01-s2-cli-mcp-parity-smoke.md)

<!-- /DOCS-NAV -->
