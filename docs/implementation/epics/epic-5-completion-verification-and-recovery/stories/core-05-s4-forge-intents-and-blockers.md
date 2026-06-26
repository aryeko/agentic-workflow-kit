---
title: "core-05-s4-forge-intents-and-blockers implementation story"
id: "core-05-s4-forge-intents-and-blockers"
epic: 5
status: "story: ready"
design:
  - "docs/design/30-domain-reference/core/completion-and-merge/README.md"
  - "docs/design/30-domain-reference/core/completion-and-merge/evidence-model-and-predicates.md"
---

# core-05-s4-forge-intents-and-blockers

## Purpose

Record exact-head Forge operation intents, merge intents, and blocker-evidence PR intents as durable
barrier events while keeping blocker publication separate from task completion or merge readiness.

## Normative Design

- `docs/design/30-domain-reference/core/completion-and-merge/README.md`
- `docs/design/30-domain-reference/core/completion-and-merge/evidence-model-and-predicates.md`
- `docs/implementation/epics/epic-5-completion-verification-and-recovery/story-dag.md`

If these sources do not answer a contract question, this story is not ready.

## Spec Surface

- Interfaces / types: `recordForgeOperationIntent`, `recordMergeIntent`,
  `recordBlockerEvidenceIntent`.
- Events / append intents: `ForgeOperationIntentRecorded`, `MergeIntentRecorded`.
- Provider operations / commands: none; this story records intent only. Forge performs writes later.
- Failure and degraded tokens: consumes blocker-eligible core-05 catalogs and `merge-intent-unwritable`.
- Evidence records / attestations: consumes exact-head completion and merge decisions, clean local git
  evidence, push/PR policy booleans, `auto-merge` gate event id, and Forge refs.

## Responsibilities

- Record `push-branch`, `upsert-pr`, `publish-blocker-evidence`, and `update-branch` Forge operation
  intents with `expectedHeadSha`.
- Record `enqueue` or `merge` merge intents only after a `merge-ready` decision, policy, gate event id,
  and exact-head evidence are present.
- Permit blocker-evidence PR intents only for explicitly eligible completion/merge states and safe exact
  head; never for ambiguous/missing/dirty local evidence, outside allowlist, unwritable events, Forge
  unavailable write paths, or any merge operation.
- Fail closed when intent append is unwritable.

## Out of Scope

- Executing Forge operations or inspecting Forge live state.
- Completion and merge predicate evaluation (`core-05-s2`, `core-05-s3`).
- Post-merge result classification (`core-05-s5`).

## Dependencies and Frozen Inputs

- Covers signals: Forge operation intent and merge intent records with `expectedHeadSha`;
  blocker-evidence PR intent separation from task completion or merge readiness.
- Depends on: `core-05-s1`, `core-05-s2`, `core-05-s3`, core-01 writer, fnd-01 push/PR/merge policy.
- Depended on by: `core-05-s5-post-merge-outcomes`, Epic 6 Forge driver stories, Epic 7 operator
  composition.
- Shared shapes consumed: `CompletionDecisionRecorded`, `MergeDecisionRecorded`,
  `core-05-s1` intent payloads and blocker-eligible state catalog.
- Decision inputs consumed: completion/merge state, `headSha`, `expectedHeadSha`, policy
  `runnerMayPush`, `runnerMayOpenPr`, `runnerMayMerge`, merge decision event id, gate event id.

## Acceptance Criteria

- **AC-1** Forge operation intents require a clean unambiguous `expectedHeadSha` and record only
  `push-branch`, `upsert-pr`, `publish-blocker-evidence`, or `update-branch` operation kinds - evidence:
  `coverage:baseline` fixture `forge-operation-intent-kind-and-head`.
- **AC-2** Merge intents are recorded only for `enqueue` or `merge` after `MergeDecisionRecorded.state
  === "merge-ready"` with matching `headSha`, policy ref, gate event id, and merge decision event id -
  evidence: `coverage:baseline` fixtures `merge-intent-ready` and `merge-intent-not-ready-rejected`.
- **AC-3** Blocker-evidence PR intents are allowed only for the exact eligible states listed by
  `core-05-s1` and policy `runnerMayPush && runnerMayOpenPr`; they carry
  `purpose = "blocker-evidence-pr"` and never `enqueue` or `merge` - evidence:
  `coverage:baseline` table `blocker-intent-eligible-state-matrix`.
- **AC-4** Blocker-evidence PR intents are rejected for `event-log-unwritable`,
  `merge-intent-unwritable`, `head-ambiguous`, `merge-head-ambiguous`, missing/dirty local evidence,
  `changed-files-outside-allowlist`, `changed-file-policy-absent`, Forge-unavailable write paths, or
  any merge intent operation - evidence: `coverage:baseline` table
  `blocker-intent-forbidden-state-matrix`.
- **AC-5** Unwritable paths return exact producer-owned tokens: `event-log-unwritable` for
  `ForgeOperationIntentRecorded` append failure or an already unwritable completion-decision input, and
  `merge-intent-unwritable` for `MergeIntentRecorded` append failure, with no success event - evidence:
  `coverage:baseline` fixture `intent-append-unwritable`.
- **AC-6** Public SDK importability exposes the three intent recorders through this story's export
  lines - evidence: `typecheck` public-import test.

## Coverage Matrix

| Responsibility / spec-surface item | Proven by | Standing gate lane |
|---|---|---|
| Exact-head Forge operation intent kinds | AC-1 | `coverage:baseline` |
| Merge intent readiness gate | AC-2 | `coverage:baseline` |
| Blocker eligible states | AC-3 | `coverage:baseline` |
| Blocker forbidden states | AC-4 | `coverage:baseline` |
| Intent append unwritable behavior | AC-5 | `coverage:baseline` |
| Public SDK exports | AC-6 | `typecheck` |

## Predicate-Input Matrix

### Consumed Predicates

| AC or failure row | Predicate / branch value | Declared source value | Producer / resolver | Verdict |
|---|---|---|---|---|
| AC-1 | exact head exists and operation kind is allowed | selected `headSha`, requested operation kind | `core-05-s2`, request input | decidable |
| AC-2 | merge decision is ready and scoped | `MergeDecisionRecorded.state`, `headSha`, gate event id, policy ref | `core-05-s3` and core-02 gate | decidable |
| AC-3..AC-4 | blocker state eligible/forbidden | completion/merge state and blocker catalog | `core-05-s1`, `core-05-s2`, `core-05-s3` | decidable |
| AC-5 | append success/failure | `RunWriter.appendBarrier` result | core-01 writer | decidable |

### Produced Obligations

| Produced record/event/symbol | Required field or symbol | Declared source | Verdict |
|---|---|---|---|
| `ForgeOperationIntentRecorded` | `operation`, `expectedHeadSha`, `purpose`, refs | request input, selected head, completion/merge event refs | closed |
| `MergeIntentRecorded` | `operation`, `expectedHeadSha`, `policyRef`, `gateEventId`, `mergeDecisionEventId` | request input, merge decision, gate record, policy input | closed |
| Public symbols | export lines | owned source plus SDK barrel lines | closed |

## Failure and Degraded Outcomes

| token | trigger | required behavior | proven by |
|---|---|---|---|
| `merge-intent-unwritable` | merge intent append fails | do not call Forge; return unwritable failure | AC-5 |
| `event-log-unwritable` | Forge operation intent append fails or consumed completion decision is already unwritable | do not call Forge; return unwritable failure | AC-5 |
| `head-ambiguous` | completion decision has no single exact head | no blocker intent | AC-4 |
| `merge-head-ambiguous` | merge decision has no single exact head | no blocker intent | AC-4 |
| `workspace-dirty` | local git evidence is dirty | no blocker intent | AC-4 |
| `changed-files-outside-allowlist` | changed paths are outside allowlist | no blocker intent | AC-4 |
| `changed-file-policy-absent` | required changed-file policy is absent | no blocker intent | AC-4 |
| `merge-forge-unavailable` | Forge write path is unavailable | no blocker intent | AC-4 |
| `merge-ready` | merge decision is already ready | no blocker intent; merge intent path must use AC-2 | AC-2, AC-3 |

## Quality Bar

- Coverage scope and threshold: `packages/sdk/src/core/completion/intents/**`, 95% branch.
- Coverage command and instrumented lanes: `pnpm check` via `coverage:baseline`.
- Required tests: AC-1..AC-6 and every failure row.
- Public exposure: `sdk` import path plus AC-6 public-import test.
- Determinism constraints: no ambient time except injected `recordedAt`; no Forge execution.
- Dependency boundaries: may consume provider DTOs as evidence refs only; no concrete provider import.
- File-size budget: 240 lines per file; split blocker matrix before 400 lines; 800 hard cap.
- Domain non-negotiables: intent before action; exact-head binding; blocker PR is not completion/merge.

## Required Reading

- Core-05 design files.
- `core-05-s1`, `core-05-s2`, `core-05-s3`.

## Deliverable

The `packages/sdk/src/core/completion/intents/**` module, tests, fixtures, and SDK export lines.

## Evidence Pack

- Intent kind, merge-ready, blocker-eligible, blocker-forbidden, and unwritable fixtures.
- Public-import test in AC-6.
- `pnpm check` result.
- Boundary sweep:
  `grep -REn "Date\\.now|new Date\\(|Math\\.random|crypto\\.randomUUID|@octokit|node:http|node:https|child_process|simple-git|merge\\(|enqueue\\(|from \"testkit\"|from \"@kit/testkit\"" packages/sdk/src/core/completion/intents packages/sdk/tests/core/completion/intents`
  returns zero matches except test fixture names where asserted.

## Boundaries and STOP Conditions

- Package/module boundary: `packages/sdk/src/core/completion/intents/**`.
- Owned pathset: `packages/sdk/src/core/completion/intents/**`,
  `packages/sdk/tests/core/completion/intents/**`, and owned SDK export lines.
- Forbidden dependencies: Forge execution clients, network/process/git APIs, recovery modules.
- STOP when a caller asks this story to perform a real push, PR, enqueue, merge, or update-branch rather
  than record a durable intent.

## Characterization Review Evidence

- Design -> AC completeness: all intent kinds, merge-intent preconditions, blocker eligible/forbidden
  states, exact-head binding, and unwritable behavior map to AC-1..AC-5.
- Producer closure: both intent event payloads have required-field sources.
- Sweep vocabulary: forbidden tokens do not ban normative operation names in tests.
- Failure-token/catalog closure: blocker and merge tokens are from `core-05-s1`.
- Verdict: ready.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 5 - stories](./README.md) · **← Prev:** [core-05-s3-merge-readiness implementation story](./core-05-s3-merge-readiness.md) · **Next →:** [core-05-s5-post-merge-outcomes implementation story](./core-05-s5-post-merge-outcomes.md)

<!-- /DOCS-NAV -->
