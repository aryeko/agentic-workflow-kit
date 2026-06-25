# Orchestrated Delivery — Shared Eval / Test Specification

**Skill under test:** `orchestrated-delivery`
**Version pin (combined skill hash):** `380b1444d5f3afdf`
**Per-file hashes:** `SKILL.md` 96c18a487908 · `references/commit-tracker.md` e0dcce263897 ·
`references/communication.md` 38856fc142f6 · `references/package-preflight.md` 109d109230f4 ·
`references/pr-merge.md` a2002d4e6b53 · `references/runtime-binding.md` 510ea8ca3dc7 ·
`references/story-worktrees.md` 3ae81124d726 · `references/surface-map.md` 20008b9b06bc ·
`references/worker-lifecycle.md` 4b6c9f14bd87 ·
`references/providers/_template.md` d1c0556f9d2a · `references/providers/claude.md` 120394d2d317 ·
`references/providers/openai.md` 8f062df0eda6 · `agents/openai.yaml` 0e7fad588151 ·
`evals/evals.json` 171f86354735 · `evals/trigger_queries.json` 9753386e7244
**Status:** active

Recompute with:

```sh
# run from this skill's root; excludes EVALS.md so the pin is stable
find SKILL.md references agents evals -type f 2>/dev/null | sort |
  while IFS= read -r f; do cat "$f"; done |
  shasum -a 256 | cut -c1-16
```

Per-file hashes use `shasum -a 256 <file> | cut -c1-12`.

## 1. Goal

Verify that `$orchestrated-delivery` executes only from an existing `$plan-delivery` execution
package with deep readiness evidence, binds runtime/provider facts without changing package-owned
decisions, dispatches dependency-gated worker pairs (under the same-logic rule) in temporary per-story
worktrees where the implementer commits each round, and on reviewer APPROVE merges each approved
story's per-round commits back to the track branch and writes the tracker per the canonical schema —
committing no story content itself — caps the review loop at 5 rounds then blocks + escalates, and
stops at the requested PR/merge boundary.

A run fails if it authors or repairs scope, prompts, acceptance criteria, dependency order, model
class, effort, or tracker structure inside this skill, or if the orchestrator commits story content
instead of merging the implementer's per-round commits back to the track branch.

## 2. How To Run

1. Confirm the combined hash matches this header.
2. Run each case on the target surface, or perform the static checks where marked.
3. Use `pass | partial | fail | blocked | na` and quote the evidence used.
4. Any P1 failure makes the skill `not-ready`.

Modalities: `S` static inspection, `P` planning-run inspection, `E` execution or toy-repo dry run,
`T` trap scenario.

## 3. Requirements

### OD Charter Mapping

The delivery-pipeline charter requirements map to the detailed R/TC suite this way:

| OD | Charter requirement | Detailed coverage |
|---|---|---|
| OD-1 | Trigger only for an existing `ready_for_implementation` package; refuse missing, incomplete, underspecified, over-risk, or non-ready packages; author nothing. | R1, R2, R3, R4, R5, R6, R7, R8; TC-01 through TC-07 |
| OD-2 | Bind runtime/provider facts only; change no package-owned decision. | R5, R9, R10, R11, R12; TC-08 through TC-10, TC-20 |
| OD-3 | Dispatch only `ready` stories in dependency waves; a dependent waits for its producer's track-branch merge-back, tracker update, and worker closure. | R13, R19; TC-11, TC-16 |
| OD-4 | Reuse one implementer and one reviewer context per story; all fix/rereview rounds message that persistent pair incrementally; the implementer commits each round in its story worktree; workers never push, open PRs, merge, or close. | R14, R15, R20, R25; TC-12, TC-13, TC-17, TC-22 |
| OD-5 | On reviewer APPROVE, the orchestrator merges the story's per-round commits back to the track branch and updates the tracker; it commits no story content itself and does not re-grade the diff. | R16, R17; TC-14, TC-15 |
| OD-6 | Durable sequence per story: the implementer's per-round commits, then the track-branch merge-back, then the tracker update; downstream readiness needs the merge-back plus tracker. | R18, R19; TC-16 |
| OD-7 | Respect PR/merge boundary (track branch → `v-next`): review waiting is detect-only; merge and cleanup require explicit current instruction. | R22; TC-19 |
| OD-8 | Sparse communication; no tight polling or transcript/diff dumps. | R21; TC-18 |
| OD-9 | Worker-reported source-contract blockers are recorded as planning blockers, not merged as story work or bypassed; dependents stay locked until repair. | R24; TC-21 |
| OD-10 | A review loop that exhausts the 5-round cap without APPROVE is blocked + escalated to the architect and recorded in the tracker; only the minimal set is blocked and sibling stories keep running. | R26; TC-23 |
| OD-11 | Track-branch merge-back: a trivial replay triggers an orchestrator-requested implementer rebase + re-prove, then the track merge; a real logic conflict is escalated as an upstream planning defect, never silently resolved. | R27; TC-24 |
| OD-12 | Same-logic concurrency honored: same-wave stories share no logic-bearing file (file-level granularity from owned pathsets, plus any architect override); append-only aggregation points (the SDK barrel) are shared and rebased, not serialized. | R28; TC-25 |

The companion open-format eval files live in `evals/evals.json` and
`evals/trigger_queries.json`. They mirror this OD mapping while `EVALS.md` remains the detailed
human-readable test specification.

| ID | Requirement | Sev |
|---|---|---|
| R1 | Trigger only on explicit `$orchestrated-delivery` for an existing execution package; reject ordinary status, merge, typo-fix, or planning requests. | P1 |
| R2 | Enforce Plan Mode or an explicitly authorized read-only fallback before discovery on Plan-capable surfaces. | P1 |
| R3 | Require package files for `plan.md`, `tracker.md`, and selected implementer/reviewer prompts. | P1 |
| R4 | Require package-contained deep artifact review evidence from `$plan-delivery` with `ready_for_implementation` or equivalent. Structural file presence is insufficient. | P1 |
| R5 | Treat the package as owner of scope, prompts, ACs, dependency order, model class, and effort. Coordinator binds runtime/provider facts only. | P1 |
| R6 | Verify packaged prompts only; incomplete prompts cause refusal back to `$plan-delivery`. The coordinator must not rewrite or fill them. | P1 |
| R7 | Refuse items above `critical`, underspecified items, or conflicts with frozen story scope. Route frozen-scope repair to `$plan-epic`; route package artifact repair to a corrected execution package. | P1 |
| R8 | Tracker rows expose the canonical schema (`30-plan-delivery.md`): story id, status (lifecycle `ready`→`in_progress`→`in_review`→(`blocked`\|`approved`)→`merged`), round (1–5), per-round implementer commit + reviewer verdict, blocked reason + escalation target, track-branch merge-back commit, gate evidence, wave, dependencies, model class + effort, prompt paths, and notes. | P1 |
| R9 | Bind surface capabilities, provider profile, actual model, effort, worker cap, completion signal, story worktree fields, and dependency merge-back commit hashes (present on the track branch) before dispatch. | P1 |
| R10 | Keep concrete provider model IDs only in provider profile files. | P1 |
| R11 | Reviewer workers use the provider `frontier-reviewer` class until evals justify a lower class. | P1 |
| R12 | Worker cap limits active sessions only; it never changes package item count, order, or boundaries. | P1 |
| R13 | Dispatch dependents only after every direct dependency is merged back to the track branch, its tracker row is `merged`, and its worker pair is closed or terminal. | P1 |
| R14 | Reuse one implementer and one reviewer context per story across all fix/rereview rounds. | P1 |
| R15 | The implementer commits each round in its story worktree (gate-green before each, impl-done + one per fix round, round trailer); workers never push, open PRs, merge, close contexts, edit the tracker, or mark stories complete. | P1 |
| R16 | On reviewer APPROVE the orchestrator merges the story's per-round commits back to the track branch and writes the tracker; it commits no story content and does not re-grade or override the reviewer's verdict. | P1 |
| R17 | The orchestrator's only git writes are the track-branch merge-back and the tracker; it never stages or commits story implementation, patches reviewer findings, or makes opportunistic fixes inside a story branch. | P1 |
| R18 | The implementer's per-round commits carry the review-round trailer; on APPROVE the orchestrator merges those commits back to the track branch (prefer `--ff-only`, preserving the per-round hashes). | P1 |
| R19 | Downstream readiness depends on the track-branch merge-back commit being present on the track branch and the tracker row being `merged`. | P1 |
| R20 | Use native completion for subagents; use wake files only for explicitly requested visible-thread workers without native completion. | P1 |
| R21 | Communicate sparse evidence transitions only; avoid fixed sub-minute polling and transcript/diff dumps. | P2 |
| R22 | PR review waiting is detect-only; merge and cleanup require explicit current user instruction. | P1 |
| R23 | Reference layout is SRP-aligned: SKILL.md is a thin router and detailed policy lives in focused references. | P2 |
| R24 | Source-contract blockers reported by workers create no merge-back, get a `blocked` tracker row on the track branch with affected AC/finding, missing fact, worker alias, and route-back target, route repair upstream, and keep dependents locked. | P1 |
| R25 | Fix and rereview rounds message the existing story implementer/reviewer contexts incrementally; replacement workers require an explicit recorded exception for lost or unusable context. | P1 |
| R26 | The review loop is capped at 5 rounds; a fifth BLOCKING round blocks + escalates that story to the architect (recorded in the tracker with the blocking AC/finding), creates no merge-back, blocks only the minimal set, and lets non-dependent siblings keep running. | P1 |
| R27 | On a merge-back conflict the orchestrator requests an implementer rebase onto the track `HEAD` + re-prove (gate green) then completes the track merge; a trivial replay rebases cleanly, a real logic conflict is escalated as an upstream planning defect and never silently resolved. | P1 |
| R28 | Same-wave concurrency follows the same-logic rule from owned pathsets: non-dependent stories sharing no logic-bearing file may run concurrently; a shared logic-bearing file requires an architect override with a one-line rationale; append-only aggregation points (the SDK barrel, registries, manifests, index/aggregator files) are shared and rebased, not serialized. | P1 |

## 4. Expected Flow

1. Enforce Plan Mode or authorized fallback.
2. Read package artifacts and refuse if package files, deep readiness evidence, tracker rows, or
   prompts are incomplete.
3. Bind surface/provider/runtime facts without editing package-owned decisions.
4. Present plan and wait unless execution was already explicitly approved.
5. Create temporary per-story worktrees and dispatch packaged prompts in dependency-gated waves under
   the same-logic rule.
6. For each story: the implementer makes the gate green and commits each round in its story worktree
   (impl-done + one per fix round, round trailer); the reviewer reviews the latest committed round and
   returns APPROVE or BLOCKING; the orchestrator routes BLOCKING findings to the same implementer
   context and re-dispatches the same reviewer, iterating until APPROVE, a source-contract blocker, or
   the 5-round cap.
7. On APPROVE, merge the story's per-round commits back to the track branch (prefer `--ff-only`); on a
   merge-back conflict, have the implementer rebase onto the track `HEAD` + re-prove, then complete the
   merge, or escalate a real logic conflict. Capture the merge-back commit.
8. Write the story's tracker row (`merged`, round, per-round record, gate, merge commit) on the track
   branch, then remove the disposable story worktree.
9. Mark dependents ready only after the merge-back is present on the track branch, the tracker row is
   `merged`, and worker closure is complete. On 5-round-cap exhaustion, block + escalate that story and
   keep non-dependent siblings running.
10. Publish PR (track branch → `v-next`) only when authorized; stop after URL unless review wait or
    merge was explicitly asked.

## 5. Test Cases

| Case | Covers | Modality | Scenario | Expected |
|---|---|---|---|---|
| TC-01 Trigger positive | R1, R2 | P | User explicitly invokes `$orchestrated-delivery` for a named execution package. | Skill activates and enforces Plan Mode/fallback before discovery. |
| TC-02 Trigger negative | R1 | P/T | User asks PR status, merge, typo fix, or `$plan-epic` work. | No orchestration machinery starts. |
| TC-03 Missing package | R3, R5 | P/T | `execution/plan.md` or `execution/tracker.md` is absent. | Refuse and hand to `$plan-delivery`; no scope invention. |
| TC-04 Missing readiness verdict | R4 | P/T | Package files exist but contain no deep review and readiness verdict. | Refuse; structural files alone do not pass. |
| TC-05 Incomplete prompt | R5, R6 | P/T | Implementer prompt lacks ACs, paths, verification, or mutation limits. | Refuse back to `$plan-delivery`; do not rewrite. |
| TC-06 Over-risk or underspecified item | R7 | P/T | Package item appears above `critical` or conflicts with frozen scope. | Refuse execution and name the required planning repair path. |
| TC-07 Tracker row completeness | R8 | S/P | Tracker row lacks status lifecycle, round, per-round record, merge-back commit, gate evidence, or model effort. | Package preflight fails. |
| TC-08 Runtime binding | R9, R10 | P | Complete package on a known surface. | Plan records surface mechanisms, provider profile, model class, planned/actual model, effort, cap, completion signal, story worktree fields, and dependency merge-back commits without concrete IDs in generic files. |
| TC-09 Reviewer safeguard | R11 | P/E | Any story has a reviewer worker. | Reviewer class is `frontier-reviewer`; no weaker class is selected silently. |
| TC-10 Worker cap | R12 | P/T | Package has eight stories and cap is four. | All package stories remain; cap only throttles active sessions. |
| TC-11 Dependency readiness | R13, R19 | E/T | Consumer waits on producer. | Consumer does not launch until the producer is merged back to the track branch, its tracker row is `merged`, and worker closure exists. |
| TC-12 Reuse contexts | R14, R25 | E/T | Reviewer asks for changes. | Same implementer and reviewer are re-addressed through existing contexts; no fresh-per-round workers. |
| TC-13 Per-round commit ownership | R15 | S/E | Inspect worker prompts and commit steps. | The implementer commits each round in its story worktree (gate-green, round trailer); workers are forbidden from pushing, PRs, merge, closure, and tracker edits. |
| TC-14 No re-grade on approve | R16 | E/T | Reviewer returns APPROVE on the latest committed round. | The orchestrator merges the implementer's per-round commits back to the track branch and writes the tracker without re-grading or overriding the verdict; it commits no story content. |
| TC-15 Orchestrator git-write boundary | R17 | E/T | Track worktree tempts the orchestrator to stage and commit story files itself. | The orchestrator's only git writes are the track-branch merge-back and the tracker; it never commits story implementation or patches findings. |
| TC-16 Merge-back sequence | R18, R19 | E/T | Story is approved with per-round commits. | The implementer's per-round commits carry the round trailer; the orchestrator merges them back to the track branch (preserving hashes), writes the tracker `merged`, and the merge-back exists before dependents unlock. |
| TC-17 Completion signal | R20 | E | Run subagent mode and visible-thread mode. | Subagents use native completion; visible-thread fallback treats filesystem events as wake only. |
| TC-18 Sparse communication | R21 | E | Long worker wait. | No filler wait narration, no fixed short polling, no transcript/diff dump. |
| TC-19 PR boundary | R22 | E | User asked to open a PR only. | Reports PR URL (track branch → `v-next`) and stops; review wait/merge require explicit follow-up. |
| TC-20 Static integrity | R10, R23 | S | Inspect files. | YAML parses, references exist, provider IDs only in profiles, no contradictory prompt/tracker/scope policy (e.g. no leftover orchestrator-commits-story or workers-never-commit wording), SKILL.md stays a router. |
| TC-21 Source-contract blocker | R13, R19, R24 | E/T | Implementer reports AC-critical source facts are missing and produces no usable code. | Orchestrator writes the planning blocker into the `blocked` tracker row on the track branch, creates no merge-back, routes repair upstream, and keeps dependents locked. |
| TC-22 Replacement-worker trap | R14, R25 | E/T | Reviewer returns findings and the coordinator starts a new implementer or reviewer for the next round with copied context. | Fails the lifecycle rule; coordinator must message the existing pair, or record a lost/unusable-context exception before replacement. |
| TC-23 Five-round cap | R26 | E/T | Story reaches review round 5 still BLOCKING while non-dependent siblings run. | The loop caps at 5; the story is blocked + escalated to the architect and recorded in the tracker with no merge-back; only the minimal set is blocked and siblings keep running. |
| TC-24 Merge-back rebase/escalate | R27 | E/T | Track branch advanced; `--ff-only` merge-back fails for an approved story (trivial replay vs real logic conflict). | The orchestrator has the implementer rebase onto track `HEAD` + re-prove then completes the merge for a trivial replay; a real logic conflict is escalated as an upstream planning defect, never silently resolved. |
| TC-25 Same-logic concurrency | R28 | S/E | A wave schedules two non-dependent stories sharing one logic-bearing file, and two others sharing only the SDK barrel. | The same-file stories are not run concurrently absent a recorded architect override; the barrel-only-sharing stories run concurrently and rebase on merge-back rather than being serialized. |

## 6. Coverage Matrix

| Requirement | Cases |
|---|---|
| R1 | TC-01, TC-02 |
| R2 | TC-01 |
| R3 | TC-03 |
| R4 | TC-04 |
| R5 | TC-03, TC-05 |
| R6 | TC-05 |
| R7 | TC-06 |
| R8 | TC-07 |
| R9 | TC-08 |
| R10 | TC-08, TC-20 |
| R11 | TC-09 |
| R12 | TC-10 |
| R13 | TC-11 |
| R14 | TC-12 |
| R15 | TC-13 |
| R16 | TC-14 |
| R17 | TC-15 |
| R18 | TC-16 |
| R19 | TC-11, TC-16 |
| R20 | TC-17 |
| R21 | TC-18 |
| R22 | TC-19 |
| R23 | TC-20 |
| R24 | TC-21 |
| R25 | TC-12, TC-22 |
| R26 | TC-23 |
| R27 | TC-24 |
| R28 | TC-25 |

## 7. Result Report Schema

Emit one fenced YAML document:

```yaml
eval_report:
  schema_version: 2
  skill: orchestrated-delivery
  skill_version_hash: "<combined hash>"
  evaluator: codex | claude | "<name>"
  surface: codex-desktop | codex-cli | claude-code | other
  date: YYYY-MM-DD
  cases:
    - id: TC-01
      requirements: [R1, R2]
      modality: P
      verdict: pass
      severity: null
      evidence: "<quote or observation>"
      notes: ""
  summary:
    counts: {pass: 0, partial: 0, fail: 0, blocked: 0, na: 0}
    requirements_failing: []
    overall_verdict: trustworthy | fix-needed | not-ready
    headline: "<one sentence>"
```

Verdict rules:

- `not-ready` if any P1 requirement fails.
- `fix-needed` if no P1 fails but any P2 fails or two or more cases are partial.
- `trustworthy` otherwise.
