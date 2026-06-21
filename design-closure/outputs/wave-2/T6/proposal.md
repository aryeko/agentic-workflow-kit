---
title: "T6 - Close core-03 Approval & Escalation - PROPOSAL"
task: "T6 / core-03 - design-closure wave-2 (DECISION task)"
status: "recommendation - NOT applied; no corpus file edited"
owner: "Wave 2 T6 worker"
date: "2026-06-21"
---

# T6 - Close core-03 Approval & Escalation

This is a recommendation for an architect ruling, not an applied corpus change. It consumes the frozen
Wave-1 T1 policy-field decision and T2 `ScopedGrant` decision as inputs.

## Decision / answer

### Recommendation 1: default `approval.decisionWindowMs = 900000`

Set the built-in default for `ResolvedPolicy.policy.approval.decisionWindowMs` to **900000 ms (15
minutes)**.

The field name and type are frozen by Wave-1 T1 as `approval.decisionWindowMs`; T1 intentionally
deferred only the numeric default to T6 (`design-closure/outputs/wave-1/WAVE-1-SUMMARY.md` section Frozen
decisions / T1; `design-closure/outputs/wave-1/T1/draft/resolved-policy.contract.md` section approval). This
is consistent with fnd-01's deterministic policy model: built-in defaults are a complete immutable
`PolicyLayer`, profiles and operator overrides are sparse patches, and resolution records per-field
provenance (`docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md`
section Config shape, section Safe defaults, section Deterministic precedence; `.../interfaces-events-and-verification.md`
section Exposed interface, `ResolvedPolicy`).

Semantics to amend into core-03:

- `decisionDeadline = ApprovalRequest.expiresAt ?? (ApprovalRequest.requestedAt +
  policy.approval.decisionWindowMs)`.
- A valid decision must be recorded strictly before `decisionDeadline`.
- If a pending or parked request is evaluated at or after `decisionDeadline`, record
  `approval-expired` and outcome `expired`.
- The live-answer time box remains the shorter operational channel deadline recorded in
  `ApprovalPendingPersisted`; when that live window elapses before `decisionDeadline`, the request parks
  instead of expiring.

This preserves the existing core-03 distinction between a short live answer window and an authoritative
pending request: `ApprovalPendingPersisted` is the durable checkpoint, live-window elapsed transitions
to `parked`, and only `expiresAt` or the policy decision window transitions to `expired`
(`docs/design/30-domain-reference/core/approval-and-escalation/park-resume-and-failures.md` section Durable
park/resume state machine). It also makes the required tests concrete: with `requestedAt = 0` and no
request `expiresAt`, `evaluatedAt = 899999` is not expired, while `evaluatedAt = 900000` is expired;
with a live channel deadline before 900000, evaluating after the live deadline but before 900000 parks
instead of expiring (`docs/design/30-domain-reference/core/approval-and-escalation/interfaces-events-and-tests.md`
section Events & data, section Testing strategy).

Rejected alternatives:

- **300000 ms (5 minutes):** lower operator latency, but too short for a supervised manual or assisted
  workflow where human attention is first-class and high risk always escalates to a human
  (`docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md` section Mode ladder and
  scoped grant taxonomy; `docs/design/40-decisions/accepted-decisions.md` section AD-14).
- **3600000 ms (60 minutes):** more tolerant of interruptions, but delays fail-closed expiry too long
  for an approval that blocks worker execution; core-03 already parks for human latency and process
  death, so the default should be bounded (`docs/design/30-domain-reference/core/approval-and-escalation/README.md`
  section Mandate, section Design).
- **No built-in default:** rejected because fnd-01 requires complete safe defaults and `approval-expired`
  is already a named fail-closed state (`docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md`
  section Safe defaults; `docs/design/30-domain-reference/core/approval-and-escalation/park-resume-and-failures.md`
  section Failure and degraded modes).

### Recommendation 2: deterministic `PolicyGrantPlan` to `ScopedGrant` mapping

Keep the Wave-1 T2 frozen `ScopedGrant` shape exactly as-is: `ScopedGrant.kind` is one of the
approved `ScopedGrantKind` literals and `ScopedGrant.scope` is exactly `"request" | "turn" |
"session"` (`design-closure/outputs/wave-1/WAVE-1-SUMMARY.md` section Frozen decisions / T2;
`design-closure/outputs/wave-1/T2/draft/frozen-port-surface.md` section Frozen v1 Agent port;
`docs/design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md` section Contract
types).

Amend core-03's existing grant-mapping table into this explicit algorithm. Inputs are the committed
`PolicyGrantPlan`, the original `ApprovalRequest`, the resolved policy evidence that selected the
plan, and the committed `ApprovalDecisionRecorded` event id. `grantEventId` is populated from that
committed decision event before calling Agent `answerApproval`, as the current corpus already requires
(`docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md` section Mode ladder and
scoped grant taxonomy).

| Condition | Resulting `ScopedGrant` | Invalid if |
|---|---|---|
| `plan.scope = "per-command"` and `request.subject = "command"` | `kind: "command-once"`, `scope: "request"`, `command: plan.command ?? request.command` | no exact command, command differs from recorded request evidence |
| `plan.scope = "per-command-prefix"` and `request.subject = "command"` | `kind: "command-policy-amendment"`, `scope: "turn"`, `commandPrefix: plan.commandPrefix` | prefix absent, not from the matched resolved `grantRules`, or would be a shell fragment |
| `plan.scope = "per-host"` and `request.subject = "network"` | `kind: "network-permission"`, `scope: "turn"`, `networkHost: plan.host ?? request.host`, `networkAction: "allow"` | host absent, wildcard/private/local metadata/not allowlisted, or subject is not network |
| `plan.scope = "session"` and `request.subject = "command"` | `kind: "command-session"`, `scope: "session"`, exact `command` or approved `commandPrefix`, plus `sessionId` evidence in `content` if needed | no current non-ambiguous `sessionId`, no exact command or policy prefix, or not human-approved |
| `plan.scope = "session"` and `request.subject = "file-change"` | `kind: "file-change-session"`, `scope: "session"`, `filePaths: request.filePaths` | no current non-ambiguous `sessionId`, empty/unbounded `filePaths`, or not human-approved |
| deny / continue | `kind: "deny-continue"`, `scope: "request"`, denial reason in `content` | denial disposition is absent or contradictory |
| deny / interrupt | `kind: "deny-interrupt"`, `scope: "request"`, denial reason in `content` | denial disposition is absent or contradictory |
| deny / park | `kind: "deny-park"`, `scope: "request"`, denial reason in `content` | denial disposition is absent or contradictory |

All other combinations are **invalid** and must record `Decision.decision = "blocked"` with
`approval-grant-mapping-invalid`. That includes a policy plan that would require `filesystem-permission`,
`mcp-elicitation-content`, or `tool-user-input-content`: those are frozen prov-01 `ScopedGrantKind`
values, but core-03 has no approved policy-level scope and required-field rule for them
(`docs/design/30-domain-reference/providers/agent-execution/contracts-and-conformance.md` section Contract
types; `docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md` section Neutral
shapes, section Mode ladder and scoped grant taxonomy).

This is the minimal reconciliation: it preserves the current core-03 policy vocabulary
(`per-command`, `per-command-prefix`, `per-host`, `session`) and maps only to the T2-frozen
`ScopedGrant.scope` literals (`request`, `turn`, `session`). It does not add a new policy scope,
rename a T2 grant kind, or widen a request when a subject/scope pair is not representable. The existing
fail-closed rule already says any policy-level grant that cannot map to Agent `ScopedGrant` without
widening must block as `approval-grant-mapping-invalid`
(`docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md` section Mode ladder and
scoped grant taxonomy; `docs/design/30-domain-reference/core/approval-and-escalation/park-resume-and-failures.md`
section Failure and degraded modes).

Rejected alternatives:

- **Make `per-command-prefix` a `"session"` grant:** rejected because the current core-03 table maps
  `per-command-prefix` to Agent `scope: "turn"`, and widening it to session violates the tightest-scope
  rule (`docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md` section Mode ladder and
  scoped grant taxonomy).
- **Map every prov-01 `ScopedGrantKind`:** rejected because T6 closes core-03's approved policy
  vocabulary, not the whole Agent driver capability surface. Adding policy rules for
  `filesystem-permission`, MCP elicitation, or tool-user-input content would be a new core-03 design
  decision without a cited consumer requirement.
- **Pass `PolicyGrantScope` through to the Agent:** rejected because core-03 explicitly says it never
  sends `PolicyGrantScope` values to the Agent contract; `Decision.grant` is already the Agent
  `ScopedGrant` shape (`docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md`
  section Mode ladder and scoped grant taxonomy; `docs/design/30-domain-reference/core/approval-and-escalation/interfaces-events-and-tests.md`
  section Contracts & interfaces).

## Proposed artifact or change

No draft corpus file is included; the proposal above is the artifact.

If accepted, amend the relevant corpus sections as follows:

1. Add `decisionWindowMs: number` and built-in default `900000` to `ApprovalPolicy` and safe defaults.
2. Define the deadline semantics for `decisionWindowMs`, including live-window park versus final expiry.
3. Replace the current abbreviated grant-mapping table with the explicit table above, preserving the
   existing failure rule for unmappable grants.

## Corpus impact

No corpus file was edited. If accepted, the architect should amend:

- `docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md`
  - section Policy blocks: add `decisionWindowMs: number` to `ApprovalPolicy`.
  - section Safe defaults: add `approval.decisionWindowMs = 900000`.
- `docs/design/30-domain-reference/foundation/configuration-and-policy/README.md`
  - section Open questions: mark the approval/escalation field-name and decision-window-default portion
    resolved by T1/T6; keep unrelated dependency-install confirmation separate.
- `docs/design/30-domain-reference/foundation/configuration-and-policy/interfaces-events-and-verification.md`
  - section Testing strategy: add a safe-default snapshot case for `approval.decisionWindowMs`.
- `docs/design/30-domain-reference/core/approval-and-escalation/README.md`
  - section Mandate / section Design: replace "Decision-window default remains open" with the configured
    `ResolvedPolicy.policy.approval.decisionWindowMs` default and semantics.
- `docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md`
  - section Neutral shapes: note that `PolicyGrantPlan` maps using `ApprovalRequest` evidence and
    `ApprovalDecisionRecorded` id, not by sending `PolicyGrantScope` to Agent.
  - section Mode ladder and scoped grant taxonomy: replace or extend the grant-mapping table with the explicit
    valid/invalid table above.
- `docs/design/30-domain-reference/core/approval-and-escalation/park-resume-and-failures.md`
  - section Durable park/resume state machine: define `decisionDeadline` and the exact live-window park versus
    expiry predicates.
  - section Failure and degraded modes: keep `approval-grant-mapping-invalid` and `approval-expired`, with the
    new testable predicates.
- `docs/design/30-domain-reference/core/approval-and-escalation/interfaces-events-and-tests.md`
  - section Events & data: state that `ApprovalPendingPersisted` records both pending state and live answer
    deadline while final expiry comes from request `expiresAt` or `approval.decisionWindowMs`.
  - section Testing strategy: add explicit cases for live-window park, expired parked request, and each valid
    and invalid grant mapping.

## Acceptance criteria

1. **Decision-window default proposed, numeric and configurable via T1 fields.** Met. The recommended
   default is `900000` ms at `ResolvedPolicy.policy.approval.decisionWindowMs`, using the T1-frozen
   field name and fnd-01's standard defaults/profile/operator override precedence. The expired parked
   request and live-answer time-box predicates are stated above.

2. **Deterministic `PolicyGrantPlan -> ScopedGrant` mapping specified.** Met. The mapping table
   reconciles core-03 `PolicyGrantScope` values with T2-frozen Agent `ScopedGrant.scope` values and
   marks unmappable combinations as `approval-grant-mapping-invalid`.

3. **Consistent with frozen Wave-1 T1/T2 decisions; conflicts surfaced.** Met. The proposal keeps
   `approval.decisionWindowMs` as the T1-frozen field and keeps the T2-frozen `ScopedGrant` shape
   unchanged. The only surfaced corpus ambiguity is that prov-01 exposes more `ScopedGrantKind` values
   than core-03 currently has policy-level rules for; the recommendation is to block those combinations
   until a separate policy decision adds them.

4. **Missing or ambiguous T1/T2 input recorded as blocker.** Met. No T1/T2 blocker prevents T6: T1
   provides the field name/type and T2 provides the frozen `ScopedGrant` shape. The remaining ambiguity
   is corpus-local, not T1/T2-local: core-03's table is partial for some prov-01 grant kinds, so this
   proposal treats unmapped cases as invalid rather than inventing new scopes.

5. **Corpus files and sections listed; no corpus file edited.** Met. See "Corpus impact." This task
   wrote only this proposal under `design-closure/outputs/wave-2/T6/`.

## Minimal-change justification

- The only proposed fnd-01 typed-shape change is the T1-frozen addition of
  `ApprovalPolicy.decisionWindowMs`; T6 supplies the deferred numeric default. This is forced by
  core-03's open decision-window default and by the existing `approval-expired` fail-closed state
  (`docs/design/30-domain-reference/core/approval-and-escalation/README.md` section Open questions;
  `docs/design/30-domain-reference/core/approval-and-escalation/park-resume-and-failures.md` section Failure
  and degraded modes).
- The grant mapping changes no T2 type and no core-03 `PolicyGrantScope` value. It makes existing
  mapping predicates explicit and declares unmapped combinations invalid, which is already the corpus
  fail-closed rule (`docs/design/30-domain-reference/core/approval-and-escalation/decision-model.md`
  section Mode ladder and scoped grant taxonomy).

### Optional upgrades

- Add future policy scopes for `filesystem-permission`, `mcp-elicitation-content`, and
  `tool-user-input-content`. Not recommended for T6 because no core-03 policy taxonomy or risk rule for
  those Agent grant kinds is currently approved.
- Add a separate `approval.liveAnswerWindowMs` field. Not recommended for T6 because T1 froze only
  `approval.decisionWindowMs`, and the current corpus already models live answer timing as pending-state
  data rather than a separate fnd-01 policy field.

## Contradiction & open-choice log

- **Open choice resolved by recommendation:** numeric default for `approval.decisionWindowMs`.
  Recommendation: `900000` ms.
- **Corpus ambiguity:** prov-01's frozen `ScopedGrantKind` union includes grant kinds that core-03's
  approved policy-level taxonomy does not map (`filesystem-permission`, `mcp-elicitation-content`,
  `tool-user-input-content`, and one-time file-change outside the current table). Recommendation:
  leave those unmapped in core-03 v1 and block as `approval-grant-mapping-invalid` if encountered,
  rather than inventing new `PolicyGrantScope` values.
- **No T1 conflict found:** T1 supplies `approval.decisionWindowMs` and explicitly defers the numeric
  default to T6.
- **No T2 conflict found:** T2 freezes `ScopedGrant.scope = "request" | "turn" | "session"`; the
  recommended table uses only those values.
- **No existing option narrowed silently:** where this proposal rejects a subject/scope pair, it does so
  by applying the existing "cannot map without widening" failure rule.

## Open issues / assumptions / risk

- **Assumption:** `ApprovalRequest.expiresAt`, when present, is an externally supplied tighter expiry
  and should win over the policy default. This follows the existing state-machine text that expiry can
  come from `expiresAt` or policy decision window, but the corpus should spell out the precedence.
- **Assumption:** live-answer deadline is event/projection state from the Agent approval channel, not a
  new policy field. If the architect wants live-window duration configurable independently of decision
  expiry, that is an additional T1-style field decision.
- **Risk:** `900000` ms is a policy judgment, not derived from an existing corpus number. It is bounded
  and testable, but the architect may choose a different default without changing the field or mapping
  structure.
- **Risk:** blocking currently unmapped prov-01 grant kinds may be stricter than future product needs,
  but it is the safest v1 behavior because core-03 already requires the tightest grant and fails closed
  when mapping would widen.
