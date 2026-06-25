# Epic R1 Execution Package Plan

## Source Baseline

- Repo: `/Users/aryekogan/repos/workflow-kit`.
- Worktree: `/Users/aryekogan/repos/workflow-kit/.worktrees/phase-c-remediation`.
- Base branch: `v-next` (protected — PR only).
- Branch: `codex/phase-c-remediation`.
- Baseline HEAD at package authoring: `cbf07ae` (`v-next` tip; closure amendments merged at `2858a4a`, PR #151).
- Epic slug: `epic-r1-closure-remediation`.
- Author/date: delivery owner (Claude), 2026-06-25.
- Source files read: this epic's frozen `story-dag.md` (`story-dag: frozen`) and both `story: ready`
  contracts; the amended design seams cited by each story; the closure audit (`#7`, `#18`) and Phase-C
  remediation plan.

## Readiness Verdict

**ready_for_implementation.** Gate 1 is met: the story DAG is `story-dag: frozen` and both selected
stories are `story: ready`, with characterization review recorded and an independent read-only review that
cleared all blocking findings (the fnd-04 story was narrowed to finding #7 after the review confirmed
#5/#6/#8/#9 are already closed in delivered code). This package projects only from those frozen artifacts;
it adds no scope.

## Implementation-Readiness Evidence

`$plan-delivery` performed a deep artifact review before issuing the verdict:

- **Sources reviewed:** `story-dag.md` (frozen), `stories/fnd-04-r1-required-attester-source.md`,
  `stories/core-01-r1-create-run-requested-by.md`, the charter, and the amended design seams
  (`credentials-and-secrets/contracts-and-events.md` lines 48–56, `.../README.md` lines 132–135;
  `run-lifecycle-and-state/contracts.md` lines 26–30, 76).
- **Selected stories covered:** both stories in the frozen DAG are projected (2 of 2); no story is omitted
  or added.
- **Per-artifact checks performed:** every prompt and tracker row cites its source story id and the source
  AC ids; owned pathsets are copied verbatim from the contracts; routing carries the DAG suggested-tier
  floor unchanged and binds no concrete provider model id; failure tokens and STOP conditions are copied
  from the contracts.
- **Independent reviewer verdict:** the Gate-1 independent review returned READY TO FREEZE after the
  fnd-04 rewrite; it independently verified the delivered-code facts (RequiredAttester carries the three
  runtime-only fields; #5/#6/#8/#9 already closed) and that AC-3/AC-4 do not weaken a required security
  check.

## Projection Summary

| story id | source AC ids | job | wave | dependencies | dependents | owned pathset | suggested-tier floor | routing |
|---|---|---|---|---|---|---|---|---|
| `fnd-04-r1-required-attester-source` | AC-1..AC-6 | Narrow `RequiredAttester` to the design shape; drop the `'runtime-metadata-missing'` fabrication; correct the release-match (finding #7) | 1 | none | none | `packages/sdk/src/foundation/credentials-secrets/**`, `packages/sdk/tests/foundation/credentials-secrets/**` | `elevated` | implementer: `strong-coder`; effort `high`; reasoning `elevated`; DAG floor `elevated`; rationale: fnd-04-r1 covers AC-1..AC-6 over a security-sensitive egress-attestation release-match and a public `RequiredAttester` shape (safety boundary). reviewer: `frontier-reviewer`; effort `high`; reasoning `elevated`; DAG floor `elevated`; rationale: same security boundary + must confirm denial behaviour preserved. |
| `core-01-r1-create-run-requested-by` | AC-1..AC-3 | Add top-level required `requestedBy` to `CreateRunInput`; source `RunCreatedPayload.requestedBy` from it | 1 | none | none | `packages/sdk/src/core/run-lifecycle/**`, `packages/sdk/tests/core/run-lifecycle/**` | `light` | implementer: `general-coder`; effort `medium`; reasoning `standard`; DAG floor `light`; rationale: core-01-r1 covers AC-1..AC-3; additive single-field change but on the public shared `CreateRunInput` shape (cross-domain contract), so `standard` ≥ floor `light`. reviewer: `frontier-reviewer`; effort `medium`; reasoning `standard`; DAG floor `light`; rationale: public shared type; confirm required-not-optional + single source. |

## Execution Waves

- **Wave 1 (parallel):** `fnd-04-r1-required-attester-source` and `core-01-r1-create-run-requested-by`.
  Independent (no intra-epic edge, no shared shape produced here), different packages/pathsets — dispatch
  concurrently in separate per-story worktrees.

## Prompt Inventory

| story id | source AC ids | implementer prompt | reviewer prompt |
|---|---|---|---|
| `fnd-04-r1-required-attester-source` | AC-1..AC-6 | `execution/prompts/fnd-04-r1-required-attester-source/implementer.md` | `execution/prompts/fnd-04-r1-required-attester-source/reviewer.md` |
| `core-01-r1-create-run-requested-by` | AC-1..AC-3 | `execution/prompts/core-01-r1-create-run-requested-by/implementer.md` | `execution/prompts/core-01-r1-create-run-requested-by/reviewer.md` |

## Verification Policy

- **Per-story targeted checks:** run the story's catalogued unit/type tests + coverage lane over its owned
  pathset (commands in each implementer prompt).
- **Required sweeps:** fnd-04 — `required\.(platform|driverVersion|runtimeMetadataAvailable)` and the
  ambient-clock sweep, both expected zero matches (exit 1). core-01 — none beyond the public-import test.
- **Evidence pack:** each story's contract Evidence-pack items (test names per AC, negative fixtures,
  coverage number, public-import result, sweep output).
- **Repo gate:** `pnpm check` must be green over the whole worktree before any story row is `done` and
  before the PR.

## Downstream Execution Metadata

`$orchestrated-delivery` must honor: the owned pathsets (commit strictly within them per story); the
abstract routing (bind concrete models at dispatch — see Resume/owner note); the Wave-1 parallel order;
the tracker `status` lifecycle; and the stop boundary (PR boundary — owner owns PR/merge). This run is
delivered by a Claude orchestrator dispatching Claude worker subagents (no Codex); the orchestrator binds
`strong-coder`/`frontier` → a frontier Claude model at high effort, `general-coder` → a mid Claude model,
`frontier-reviewer` → a frontier Claude model at the stated effort. No provider id is bound in this
package.

## Resume Semantics

A later run reads existing tracker rows: a row already `done` with a real `commit hash` and recorded gate
evidence is not re-dispatched. `changes_requested`/`blocked` rows resume from their current state. Evidence
conflicts resolve toward git state, `pnpm check` output, and live review truth over worker prose or stale
notes.

## Stop Point

Package creation ends here. The next stage is `$orchestrated-delivery` against this package.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic R1 - Delivered-code closure remediation](../README.md) · **← Prev:** [Epic R1 - Delivered-code closure remediation](../README.md) · **Next →:** [Implementer Prompt: core-01-r1-create-run-requested-by](./prompts/core-01-r1-create-run-requested-by/implementer.md)

<!-- /DOCS-NAV -->
