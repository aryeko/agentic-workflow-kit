# Cause Analysis and Recommendations

> **Revision note (2026-06-24).** This analysis was re-derived against the operating model's two-bucket
> framework ([operating-model](../../../../implementation-authoring/operating-model/README.md)) and
> reconciled against the
> [implementation lessons ledger](../../../../implementation-authoring/lessons-ledger.md). Findings are now
> **bucket-classified**, and recommendations are re-leveled to the *cheapest catch point* — the place the
> operating model says a defect class is removed most cheaply — rather than to the latest stage that
> happened to observe it. The observed PR-churn facts below are unchanged from the original run.

## PR Review Churn

Live and GraphQL PR evidence from the original implementation closeout:

| Metric | Value | Evidence class |
|---|---:|---|
| PR number | 144 | observed |
| PR state at implementation closeout | open | observed live |
| Base branch | `v-next` | observed live |
| Head branch | `codex/orchestrated-epic3` | observed live |
| Final implementation head | `2c0b260c68364a549d29a32af09d54b33d4ccc58` | observed live |
| Required `check` on implementation head | success at 2026-06-24T07:34:41Z | observed live |
| `smoke` on implementation head | skipped at 2026-06-24T07:33:25Z | observed live |
| Review threads | 94 total | observed |
| Resolved threads | 94 | observed |
| Unresolved threads | 0 | observed |
| Finding-bearing Codex review rounds | 46 | observed |
| Inline Codex findings | 91 | observed |
| P1 findings | 29 | observed by body parse |
| P2 findings | 59 | observed by body parse |
| P3 findings | 3 | observed by body parse |
| Final no-major-issues comment | 2026-06-24T07:45:09Z on `2c0b260c68` | observed live |

Top review hot spots by file:

| Threads | Path |
|---:|---|
| 13 | `packages/sdk/src/core/capability/evaluator/guarantee-predicates.ts` |
| 8 | `packages/sdk/src/core/capability/evaluator/attestation-consumption.ts` |
| 8 | `packages/sdk/src/core/run-lifecycle/log/append-validation.ts` |
| 6 | `packages/sdk/src/core/observability/records/terminal-invariant.ts` |
| 5 | `packages/sdk/src/core/observability/records/record-analysis-outcome.ts` |
| 4 | `packages/sdk/src/core/run-lifecycle/lifecycle/transition-validator.ts` |
| 4 | `packages/sdk/src/core/run-lifecycle/log/append-envelopes.ts` |
| 4 | `packages/sdk/src/core/run-lifecycle/lifecycle/linkage-resolver.ts` |
| 4 | `packages/sdk/src/core/run-lifecycle/log/create-run.ts` |
| 4 | `packages/sdk/src/core/run-lifecycle/log/append-writer.ts` |

The hot spots cluster around:

- capability gate denial and fail-closed logic;
- evidence and attestation chronology;
- run append validation and digest/order guarantees;
- lifecycle/linkage authority;
- terminal analysis and idempotency invariants;
- cursor-bounded analysis/report behavior.

These are not random implementation bugs. They are composed runtime invariants that span story
boundaries.

## Where the findings should have been caught — the two-bucket split

The operating model routes every escape to one of two buckets, each with its own cheapest catch point
([operating-model](../../../../implementation-authoring/operating-model/README.md)):

- **Bucket 1** — the *what* was missing, imprecise, or inconsistent. Cheapest catch: **characterization
  review**, before any code (owned by `plan-epic`).
- **Bucket 2** — the *what* was clear and the builder erred. Cheapest catch: **story code review**, on the
  implemented draft (owned by the story reviewer).

The 91 PR findings are **not one population**. Auditing the late and hot-spot findings against the story
contracts that owned them splits them cleanly — and the two halves need different fixes:

| Finding cluster | Owning story | Enumerated in the contract? | Bucket | Cheapest catch |
|---|---|---|---|---|
| Attestation chronology / scope / domain / replay | `core-02-s2` | **Enumerated** — AC-9…AC-13 + failure rows + named negative fixtures | 2 | story review |
| Append ordering: epoch / digest / retry / terminal idempotency | `core-01-s4` (+ `core-01-s2` read-side) | **Enumerated** — AC-2/5/8/9 + rows | 2 | story review |
| Terminal-analysis invariant | `core-07-s3` | **Enumerated** — AC-10 + row | 2 | story review |
| Gate denial **after terminal lifecycle** | `core-02-s2` | **Absent** — no member in the 14-token denial union; lifecycle punted out of scope | 1 | characterization review |
| Analysis heads preserved **across cursor advance** | `core-07-s3` | **Absent / partial** — only same-cursor conflict + supersession pinned | 1 | characterization review |

> **Evidence class: reconstructed.** The bucket column is an analytical reconstruction: each listed
> finding was matched to its owning story contract and graded ENUMERATED / PARTIAL / ABSENT by reading the
> contract's ACs and failure table under `stories/<id>.md`. It was **not** produced by parsing all 91 PR
> threads against their exact contract clause; treat the per-cluster verdict as indicative, not
> thread-exact. The contract AC and failure-row counts cited below are `observed`.

### Bucket 2 — the bulk: enumerated, yet shipped and approved

For most hot-spot clusters the contract **already pinned the invariant** — as an acceptance criterion,
with a failure-table row, and a *named negative fixture*. `core-02-s2-gate-evaluator` is the extreme case:
**18 ACs, a 13-row failure table, one negative fixture per denial token**, a both-ways coverage matrix,
and a runnable forbidden-symbol sweep
([core-02-s2-gate-evaluator.md](../stories/core-02-s2-gate-evaluator.md)). By the authoring standard's own
bar it is a model contract. Attestation chronology/scope/domain/replay (AC-9…AC-13), append
epoch/digest/retry/terminal idempotency ordering (`core-01-s4`), and the terminal-analysis invariant
(`core-07-s3` AC-10) were all enumerated this way.

They still shipped wrong, the **story reviewer approved them**, and **`pnpm check` passed** — and the
external PR reviewer found them. That is a **review-depth and scenario-coverage** failure, not a missing
*what* and not a missing "integration review." The cheapest catch point is the **story reviewer that
already exists**, sharpened — not a new review layer downstream of it. Two concrete gaps let an enumerated
invariant ship:

- The contract's required-tests catalogue let *one* test satisfy an invariant AC. An invariant/failure AC
  needs a **required scenario matrix** — the enumerated edge set (missing / stale / malformed / future /
  self-report / post-terminal …) — not "a test exists."
- The projected story-reviewer checklist omits the operating-model reviewer's stated *real value*:
  *tests that could falsely pass*, *cross-story invariant candidates*, *dependent-story assumptions*.

### Bucket 1 — the genuinely-late P1s: cross-domain invariants never enumerated, so unowned

The two final finding-bearing rounds were both single P1s (see
[PR Review Rounds](./03-pr-review-rounds.md)): "deny unattended-run gates **after terminal lifecycle**"
and "preserve current analysis heads **across cursor advances**." Both are **composed invariants that live
in the seam between domains** — capability-gating × lifecycle terminality, and analysis-record × cursor
progression — and **neither had an owner in the DAG**.

This is verifiable in the contract. `core-02-s2`'s denial catalog is a closed 14-member union with **no
member for terminal lifecycle state**; AC-6 keys "degraded" only on replay health, missing projections, or
ambiguous linkage; and its *Out of scope* explicitly punts "the lifecycle consequence of a deny … to the
caller, not this evaluator." Nobody owned the *composed* rule "a gate must deny once the run is terminal."

The authoring standard's shared-contract / catalog-invariant-owner rule
([40-story-dag.md:68-91](../../../../implementation-authoring/authoring-standard/40-story-dag.md))
**already spans cross-story and cross-domain** — it names the `core-02`..`core-07` consumers of
`core-01`'s run event envelope as the worked example and states that *"neither side may leave the
behavior unowned."* So the gate is **not** scoped within a domain, and the escape was **not** a reach
limit of the rule. The rule can only assign an invariant that has been **enumerated** as an owned
signal/invariant — and "a gate must deny once the run is terminal" was never enumerated. It lived as
prose on the producer side (`capability-registry.md:48`, *unattended-run proceeds "until it hits … a
terminal state"*) and was punted out of scope on the consumer, so the existing ownership gate had
**nothing to assign**. The cheapest catch point would still be **characterization review** — but the
fix is to **enumerate the cross-domain invariant** (so the existing Gate-3 ownership rule applies and
asks "which story owns the deny-when-terminal behavior?"), not to invent a new owner rule. That
enumeration gap — an invariant that exists only as design prose — is the real hole this epic exposed.

## Story size concentrated the churn

`core-02-s2` carries **18 ACs** against the DAG's sizing bar of "3–10 ACs; far more → probably two
stories" ([40-story-dag.md](../../../../implementation-authoring/authoring-standard/40-story-dag.md)). Its
two files — `guarantee-predicates.ts` (13 threads) and `attestation-consumption.ts` (8) — are the
**top-two review hot spots: ~22% of all 94 threads in one over-budget story**. Oversized nodes bundle
several surfaces into one PR and create *internal* seams that per-AC review walks past — exactly where the
Bucket-1 "gate × terminal lifecycle" edge hid. The fix is upstream: **enforce the Gate-3 sizing bar at
`plan-epic`** and decompose any node materially over the AC budget, not a downstream sweep.

## Two structural tensions the run exposed

**Closed workers vs PR follow-up.** `pr-merge` routes a changes-requested finding back to "the story's
existing implementer/reviewer pair … when that pair and worktree still exist." Under `worker-cap`
pressure the pairs were closed to free slots, so PR findings landed on the **coordinator** — which is *why*
"the PR reviewer became the deepest integration reviewer" and the coordinator "absorbed too much." This is
a structural tension between capacity management and PR-time routing, not a discipline lapse.

**An unmodeled third review altitude.** The operating model staffs exactly two review altitudes —
characterization (pre-code) and story code review (post-implementation). In practice the external Codex
reviewer did the *integration* review the model does not define. Either the model should name an
integration altitude, or — preferably — the composed-invariant owner (R1a) should pull that depth left so
the PR bot is a **backstop, not the net**.

## Per-area causes (revised)

- **Package & story-contract quality.** The contracts were thorough — `core-02-s2` is a model contract by
  the standard's bar. The gaps were *structural* (no composed cross-domain invariant owner) and
  *coverage-depth* (no required scenario matrix), not contract sloppiness. The one true readiness miss —
  `core-02-s2` blocking on an unresolvable policy shape — is **already covered**: it is the case that
  birthed **LSN-21** (R6 predicate-input coverage + the `plan-delivery` self-blocking preflight). The
  action is to confirm that gate runs for the next epic, not to re-derive it.
- **Worker prompts.** Strong on scope/path/mutation control; weak on composed-package invariants —
  addressed by the scenario-matrix + reviewer-prompt fixes (R1b).
- **Coordinator.** The strongest part of the run; it absorbed too much manual bookkeeping (slot
  management, watcher polling, PR-state interpretation). Automate the bookkeeping; keep the authority.
- **Verification & gate.** `pnpm check` was necessary and repeatedly protected the branch but cannot
  assert semantic completeness; the AC-proof-rerun gap is **already covered** by **LSN-22** (the
  `type:fixtures` lane, landed in PR #146). Safety-critical domains still need scenario matrices derived
  from invariants, not only story ACs.
- **Observability.** Run-level metrics are fine; story-level retro fields are missing (story id, wave,
  round, commit hashes, gate result, per-story tokens/duration) and aliases drift from stable ids. A
  tooling gap, in the "iterate here" zone.

## Recommendations (re-leveled)

Each recommendation names its **altitude** (where it lands) and its **ledger status**.

### R1: Replace the single "pre-PR sweep" with two left-shifts (supersedes the original P0)

The original P0 — a "pre-PR integration invariant sweep" — is the *least-left* fix: a fourth review layer
*downstream* of story review, and, if the orchestrator invents the checks at runtime, a violation of
pipeline invariant **I2** ("the executor binds runtime facts, never the *what*"). Split it by bucket:

- **R1a (authoring · `plan-epic` / Gate 3) — enumerate cross-domain invariants so the *existing*
  ownership gate applies.** Gate 3 already requires every shared contract / catalog / invariant to have
  exactly one owner across producer/consumer stories (40-story-dag.md:68-91); it failed here only because
  the invariant was never enumerated (it was design prose). The fix is to make cross-domain invariants
  first-class enumerated signals — name the **owning story** (or an epic-level invariant AC set) and the
  **integration test** that proves it — so Gate 3's "neither side may leave the behavior unowned" check
  has something to bind. This is tightening enumeration + applying the existing gate, **not** a new owner
  rule. Fixes Bucket 1. **Candidate LSN-24.**
- **R1b (authoring · story contract R3 + reviewer prompt) — scenario matrix + reviewer depth.** Require a
  **scenario matrix** for every invariant/failure AC, and add *tests that could falsely pass* /
  *cross-story invariant candidates* / *dependent-story assumptions* to the story-reviewer checklist.
  Fixes Bucket 2. **Candidate LSN-25.**
- **R1c (execution · `orchestrated-delivery`, optional backstop).** If a pre-PR/integration sweep is kept,
  it must **re-run authored invariant ACs** — ideally a last-wave integration story — and never invent
  checks at runtime, preserving I2 and keeping the PR bot a backstop.

### R2: Make observability story-aware (keep — tooling)

Add structured fields to orchestration events: `storyId`, `wave`, `role`, `agentId`, `alias`,
`promptPath`, `round`, `dependsOn`, `unlockedByCommit`, `status`, `blockerCode`, `storyCommit`,
`trackerCommit`, `gateCommand`, `gateResult`, `tokenUsage`, `startedAt`, `completedAt`. Use **stable ids
as primary identity, aliases as display labels only**, so tracker and event streams join cleanly after
compaction (folds in the original P2 "stable agent identity"). Expected effect: future retros compute
story duration, review rounds, blocked time, and cost without transcript reconstruction.

### R3: Add a batched PR-review strategy (keep — with caveat)

When PR review produces repeated findings in one invariant family: collect unresolved threads, cluster by
invariant class, search siblings, patch the class, run focused tests plus `pnpm check`, resolve affected
threads, then request **one** review. Reuse the existing `thread-aware-pr-followup` / `watch-pr` skills
rather than reinventing. **Caveat:** batching reduces *rounds*, not *findings* — it is secondary to the
left-shift in R1; and "patch the whole class" can over-fix and draw new findings, so keep the batch
disciplined.

### R4: Quiet and harden watch mode (keep — low-leverage ergonomics)

Watcher output should emit only review-requested, changes-requested, approval/no-major-issues, timeout, CI
failure, unresolved-thread-count change, or a direct user-decision point; on exit without a verdict, the
wrapper runs the authoritative poll and prints the normalized result. Worth doing; do not let it crowd out
R1.

### R5: Safety-critical predicate-input readiness — ALREADY COVERED

"Can an implementer complete this without inventing a policy shape, event payload, authority rule,
ordering rule, or acceptance predicate?" is exactly **LSN-21** (R6 predicate-input coverage + the
`plan-delivery` self-blocking preflight). `core-02-s2` is the case that birthed it. Action: **confirm the
gate runs** for the next epic; do not re-add the rule.

### R6: Enforce the Gate-3 sizing bar (authoring · `plan-epic`)

Decompose any node materially over the 3–10 AC budget (`core-02-s2` at 18 would have split). Reduces the
internal-seam escapes that produced the late Bucket-1 P1.

### R7: Govern mid-run package repair and the close-workers tension (execution)

Encode two execution boundaries the run exercised implicitly: (a) a blocked package contract is repaired
**only on explicit user approval**, routed through the owning planning step, never by the orchestrator on
its own; (b) resolve the close-workers ↔ PR-follow-up tension — keep a story's pair alive (or define an
explicit re-open path) so PR-time findings do not fall back onto the coordinator.

### R8: Strengthen the delivery-retro contract itself (meta)

Make every future retro apply the method this revision demonstrates. Add to the analysis contract:
(a) **ledger reconciliation** — diff each candidate lesson against the lessons ledger and label it
`new` / `already-covered` / `recurring-despite-cover` (the last is the strongest signal: a gate that
isn't working); (b) **bucket classification** — split findings into Bucket 1 vs Bucket 2 and count them;
(c) **recommendation pressure-testing** — check each recommendation against the operating-model invariants
(one-job-per-role, catch-it-cheapest, I2) before promoting it.

### R9: Worker-pool lifecycle automation — maps to LSN-20 (conditional)

Auto-close terminal workers/reviewers after summary capture and reserve reviewer/re-address slots. This is
the deferred *skill enforcement* half of **LSN-20** (the role rule already exists; the slot-reserving
`orchestrated-delivery` change is the open precondition).

## Ledger reconciliation

The method R8 asks every future retro to apply, applied here: each candidate lesson graded against the
[lessons ledger](../../../../implementation-authoring/lessons-ledger.md).

| Candidate lesson | Status vs ledger | Cover (existing or proposed) |
|---|---|---|
| Cross-domain runtime invariant never enumerated, so Gate 3's existing ownership rule had nothing to assign | **new** | candidate **LSN-24** — enumerate cross-domain invariants so the existing Gate-3 ownership rule applies (R1a) |
| Enumerated invariant AC shipped wrong (no required scenario matrix; reviewer didn't hunt falsely-passing tests) | **new** | candidate **LSN-25** — R3 scenario matrix + story-reviewer checklist (R1b) |
| Oversized story (≫10 ACs) concentrates review churn and hides internal seams | **new** | tighten existing Gate-3 sizing enforcement (R6) — no new rule |
| Mid-run package repair needs explicit approval + planning route-back | **new (process)** | `orchestrated-delivery` boundary clarification (R7) |
| Predicate-input / "would an implementer invent a policy shape?" | **already-covered** | **LSN-21** (R6 predicate-input + `plan-delivery` preflight) |
| AC proof not re-run by the standing gate | **already-covered** | **LSN-22** (`type:fixtures` lane, PR #146) |
| Tautological cross-surface parity test | **already-covered** | **LSN-23** (`edge-01-s2`) |
| Dependency-ready = impl + review + inspect + gate + story-commit + tracker-commit + hash | **already-covered** | OD-3 / OD-6 + orchestrator two-commit sequence |
| Worker self-report is not evidence | **already-covered** | implementer/reviewer evidence model + invariant I5 |
| Capacity / slot reservation + auto-close terminal workers | **partially-covered** | **LSN-20** (conditional; skill enforcement deferred — R9) |
| Live PR state is the source of truth for long watch loops | **new (operational)** | watch tooling / `pr-merge` (R3/R4) |
| Story-level observability structured at capture time | **new (tooling)** | R2 |

No candidate was `recurring-despite-cover` this epic. Do not promote one-off implementation bugs against a
clear spec as lessons; those remain Bucket-2 review findings.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 3 Delivery Retro](./README.md) · **← Prev:** [PR Review Rounds](./03-pr-review-rounds.md) · **Next →:** [Evidence and Method](./05-evidence-and-method.md)

<!-- /DOCS-NAV -->
