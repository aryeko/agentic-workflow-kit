---
title: "core-05-s5-post-merge-outcomes implementation story"
id: "core-05-s5-post-merge-outcomes"
epic: 5
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/completion-and-merge/README.md"
  - "docs/design/30-domain-reference/core/completion-and-merge/evidence-model-and-predicates.md"
---

# core-05-s5-post-merge-outcomes

## Purpose

Classify committed Forge merge action results into `PostMergeOutcomeRecorded` facts and lifecycle targets
without treating merge intent, prose, or ambiguous Forge state as completion.

## Normative Design

- `docs/design/30-domain-reference/core/completion-and-merge/README.md`
- `docs/design/30-domain-reference/core/completion-and-merge/evidence-model-and-predicates.md`
- `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`

If these sources do not answer a contract question, this story is not ready.

## Spec Surface

- Interfaces / types: `classifyPostMergeOutcome`, `recordPostMergeOutcome`.
- Events / append intents: `PostMergeOutcomeRecorded`.
- Provider operations / commands: none; consumes committed Forge action result evidence only.
- Failure and degraded tokens: consumes `PostMergeOutcomeState` from `core-05-s1`.
- Evidence records / attestations: `MergeIntentRecorded`, Forge merge/refusal/action result evidence,
  exact-head refs.

## Responsibilities

- Map Forge merged/queue success at `expectedHeadSha` to `post-merge-confirmed` and lifecycle target
  `completed`.
- Map exact-head retryable refusals to `post-merge-retryable-refused` and lifecycle target
  `merge-waiting`.
- Map exact-head operator/policy blockers to `post-merge-blocked` and lifecycle target `blocked`.
- Map provider invariant/auth/redaction/credential/impossible-method failures to `post-merge-failed`
  and lifecycle target `failed`.
- Map missing, unwritable, not-exact-head, unknown, or contradictory action results to
  `post-merge-outcome-ambiguous` and lifecycle target `blocked`.
- Append `PostMergeOutcomeRecorded` with exact head evidence and source action event id.

## Out of Scope

- Performing Forge merge/enqueue/update operations.
- Recording lifecycle transitions; core-01 owns the lifecycle transition that cites this fact.
- Recovery classification over ambiguous or retryable outcomes (`core-06-s2`).

## Dependencies and Frozen Inputs

- Covers signals: post-merge outcome classification into lifecycle targets.
- Depends on: `core-05-s1-completion-contracts`, `core-05-s4-forge-intents-and-blockers`, Forge action
  result evidence DTOs, core-01 writer/lifecycle contracts.
- Depended on by: core-06 recovery snapshot assemblers and Epic 7.
- Shared shapes consumed: `core-05-s1/PostMergeOutcomeState`, `core-05-s4/MergeIntentRecorded`.
- Decision inputs consumed: Forge action result kind, exact-head proof, retryability, blocker/failure
  reason class, source action event id, `expectedHeadSha`.

## Acceptance Criteria

- **AC-1** Successful Forge merge or queue completion proves the PR merged at `expectedHeadSha` and maps
  to `post-merge-confirmed` plus lifecycle target `completed` - evidence: `coverage:baseline` fixture
  `post-merge-confirmed-exact-head`.
- **AC-2** Exact-head retryable refusals such as transient rate limit, temporary queue unavailable, or
  update-branch required map to `post-merge-retryable-refused` and lifecycle target `merge-waiting` -
  evidence: `coverage:baseline` table `post-merge-retryable-refusals`.
- **AC-3** Exact-head operator/policy blockers map to `post-merge-blocked` and lifecycle target
  `blocked`; provider invariant/auth/redaction/credential/impossible-method failures map to
  `post-merge-failed` and lifecycle target `failed` - evidence: `coverage:baseline`
  `post-merge-blocked-failed-matrix`.
- **AC-4** Missing, unwritable, not-bound-to-`expectedHeadSha`, unknown, or contradictory Forge action
  results map to `post-merge-outcome-ambiguous` and never to `completed` - evidence:
  `coverage:baseline` table `post-merge-ambiguous-never-completed`.
- **AC-5** `PostMergeOutcomeRecorded` includes source action event id, exact head evidence refs, outcome
  state, lifecycle target, and evaluated time; append failure returns no success fact - evidence:
  `coverage:baseline` fixture `post-merge-record-fields` and `post-merge-record-unwritable`.
- **AC-6** Public SDK importability exposes the classifier and recorder through this story's export lines
  - evidence: `typecheck` public-import test.

## Coverage Matrix

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| Confirmed merge mapping | AC-1 | `coverage:baseline` |
| Retryable refusal mapping | AC-2 | `coverage:baseline` |
| Blocked/failed mapping | AC-3 | `coverage:baseline` |
| Ambiguous outcome fail-closed mapping | AC-4 | `coverage:baseline` |
| `PostMergeOutcomeRecorded` fields | AC-5 | `coverage:baseline` |
| Public exports | AC-6 | `typecheck` |

## Predicate-Input Matrix

### Consumed Predicates

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-1..AC-4 | Forge result class and exact-head proof | Forge action result fields, `expectedHeadSha`, source action event id | Forge evidence + `core-05-s4` intent | decidable |
| AC-5 | append success/failure | `RunWriter.appendBarrier` result | core-01 writer | decidable |

### Produced Obligations

| Produced record/event/symbol | Required field or symbol | Declared source | Verdict |
|---|---|---|---|
| `PostMergeOutcomeRecorded` | `schema`, `state`, `lifecycleTarget` | constant schema and owned classifier result | closed |
| `PostMergeOutcomeRecorded` | `sourceActionEventId`, `expectedHeadSha`, `evidenceRefs`, `evaluatedAt` | Forge action evidence, merge intent, injected clock | closed |
| Public symbols | export lines | owned source plus SDK barrel lines | closed |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `post-merge-retryable-refused` | exact-head transient refusal | lifecycle target `merge-waiting` | AC-2 |
| `post-merge-blocked` | exact-head operator/policy blocker | lifecycle target `blocked` | AC-3 |
| `post-merge-failed` | invariant/auth/redaction/credential/impossible-method failure | lifecycle target `failed` | AC-3 |
| `post-merge-outcome-ambiguous` | missing, contradictory, unknown, unwritable, or not-exact-head result | never completed; lifecycle target `blocked` | AC-4 |

## Quality Bar

- Coverage scope and threshold: `packages/sdk/src/core/completion/post-merge/**`, 95% branch.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`.
- Required tests: AC-1..AC-6 and every outcome row.
- Public exposure: `sdk` import path plus AC-6 public-import test.
- Determinism constraints: injected `evaluatedAt`; no live Forge calls or ambient clock.
- Dependency boundaries: consumes Forge action result DTOs only; no concrete Forge driver import.
- File-size budget: 240 lines per file; split mapping tables before 400 lines; 800 hard cap.
- Domain non-negotiables: completed is recorded only after exact-head merged evidence is durable.

## Required Reading

- Core-05 design files.
- `core-05-s1-completion-contracts` and `core-05-s4-forge-intents-and-blockers`.

## Deliverable

The `packages/sdk/src/core/completion/post-merge/**` module, tests, fixtures, and SDK export lines.

## Evidence Pack

- Outcome mapping table tests and append field tests.
- Public-import test in AC-6.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|@octokit|node:http|node:https|child_process|simple-git|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/completion/post-merge packages/sdk/tests/core/completion/post-merge`
  returns zero matches except test-only fixtures.

## Boundaries and STOP Conditions

- Package/module boundary: `packages/sdk/src/core/completion/post-merge/**`.
- Owned pathset: `packages/sdk/src/core/completion/post-merge/**`,
  `packages/sdk/tests/core/completion/post-merge/**`, and owned SDK export lines.
- Forbidden dependencies: concrete Forge clients, lifecycle transition recording, recovery modules.
- STOP when Forge result evidence cannot prove whether the exact head merged; return ambiguous instead.

## Characterization Review Evidence

- Design -> AC completeness: all post-merge outcome rows and lifecycle target mappings map to AC-1..AC-5.
- Producer closure: all `PostMergeOutcomeRecorded` fields have sources.
- Sweep vocabulary: forbidden tokens do not ban normative outcome literals.
- Failure-token/catalog closure: all outcome tokens are produced by `core-05-s1`.
- Verdict: ready.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - stories](./README.md) · **← Prev:** [core-05-s4-forge-intents-and-blockers implementation story](./core-05-s4-forge-intents-and-blockers.md) · **Next →:** [core-06-s1-recovery-contracts implementation story](./core-06-s1-recovery-contracts.md)

<!-- /DOCS-NAV -->
