# Orchestrated Delivery — Shared Eval / Test Specification

**Skill under test:** `orchestrated-delivery`
**Version pin (combined hash):** `ded162801077f82b`
**Per-file hashes:** `SKILL.md` 228ae90a2297 · `references/commit-tracker.md` ca70c1728cca ·
`references/communication.md` c063301c3e48 · `references/package-preflight.md` ce2097805228 ·
`references/pr-merge.md` 44e309e4cc4d · `references/runtime-binding.md` 3f1229771f0f ·
`references/surface-map.md` 4d510e2a0223 · `references/worker-lifecycle.md` 266ec7be4a2d ·
`references/providers/_template.md` d46f05a56724 · `references/providers/claude.md` 120394d2d317 ·
`references/providers/openai.md` 2ef044c45b70 · `agents/openai.yaml` 77cbd6df2637
**Status:** active

Recompute with:

```sh
# run from this skill's root (the directory containing EVALS.md)
for f in SKILL.md references/*.md references/providers/_template.md references/providers/claude.md references/providers/openai.md agents/openai.yaml; do
  test -f "$f" && cat "$f"
done | shasum -a 256 | cut -c1-16
```

Per-file hashes use `shasum -a 256 <file> | cut -c1-12`.

## 1. Goal

Verify that `$orchestrated-delivery` executes only from an existing `$plan-delivery` execution
package with deep readiness evidence, binds runtime/provider facts without changing package-owned
decisions, dispatches dependency-gated worker pairs, commits each approved story, commits tracker
evidence durably after the story commit hash is known, and stops at the requested PR/merge boundary.

A run fails if it authors or repairs scope, prompts, acceptance criteria, dependency order, model
class, effort, or tracker structure inside this skill.

## 2. How To Run

1. Confirm the combined hash matches this header.
2. Run each case on the target surface, or perform the static checks where marked.
3. Use `pass | partial | fail | blocked | na` and quote the evidence used.
4. Any P1 failure makes the skill `not-ready`.

Modalities: `S` static inspection, `P` planning-run inspection, `E` execution or toy-repo dry run,
`T` trap scenario.

## 3. Requirements

| ID | Requirement | Sev |
|---|---|---|
| R1 | Trigger only on explicit `$orchestrated-delivery` for an existing execution package; reject ordinary status, merge, typo-fix, or planning requests. | P1 |
| R2 | Enforce Plan Mode or an explicitly authorized read-only fallback before discovery on Plan-capable surfaces. | P1 |
| R3 | Require package files for `plan.md`, `tracker.md`, and selected implementer/reviewer prompts. | P1 |
| R4 | Require package-contained deep artifact review evidence from `$plan-delivery` with `ready_for_implementation` or equivalent. Structural file presence is insufficient. | P1 |
| R5 | Treat the package as owner of scope, prompts, ACs, dependency order, model class, and effort. Coordinator binds runtime/provider facts only. | P1 |
| R6 | Verify packaged prompts only; incomplete prompts cause refusal back to `$plan-delivery`. The coordinator must not rewrite or fill them. | P1 |
| R7 | Refuse items above `critical`, underspecified items, or conflicts with frozen story scope. Route frozen-scope repair to `$plan-epic`; route package artifact repair to a corrected execution package. | P1 |
| R8 | Tracker rows expose story id, wave, dependencies, status, implementer/reviewer model class and effort, prompt paths, reviewer verdict, gate evidence, commit hash, blockers, and notes. | P1 |
| R9 | Bind surface capabilities, provider profile, actual model, effort, worker cap, completion signal, and dependency commit hashes before dispatch. | P1 |
| R10 | Keep concrete provider model IDs only in provider profile files. | P1 |
| R11 | Reviewer workers use the provider `frontier-reviewer` class until evals justify a lower class. | P1 |
| R12 | Worker cap limits active sessions only; it never changes package item count, order, or boundaries. | P1 |
| R13 | Dispatch dependents only after every direct dependency has both story and tracker evidence commits, and its worker pair is closed or terminal. | P1 |
| R14 | Reuse one implementer and one reviewer context per story across all fix/rereview rounds. | P1 |
| R15 | Workers never stage, commit, push, PR, merge, close contexts, or mark stories complete. | P1 |
| R16 | Coordinator treats reviewer approval as advisory and inspects diff, scope, checks, and dependency boundaries before commit. | P1 |
| R17 | Commit only the approved story pathset after quiescence and the required gate. | P1 |
| R18 | After each story commit, update the tracker with the story commit hash and make a tracker-only evidence commit. | P1 |
| R19 | Downstream readiness depends on both the story commit and the tracker evidence commit. | P1 |
| R20 | Use native completion for subagents; use wake files only for explicitly requested visible-thread workers without native completion. | P1 |
| R21 | Communicate sparse evidence transitions only; avoid fixed sub-minute polling and transcript/diff dumps. | P2 |
| R22 | PR review waiting is detect-only; merge and cleanup require explicit current user instruction. | P1 |
| R23 | Reference layout is SRP-aligned: SKILL.md is a thin router and detailed policy lives in focused references. | P2 |

## 4. Expected Flow

1. Enforce Plan Mode or authorized fallback.
2. Read package artifacts and refuse if package files, deep readiness evidence, tracker rows, or
   prompts are incomplete.
3. Bind surface/provider/runtime facts without editing package-owned decisions.
4. Present plan and wait unless execution was already explicitly approved.
5. Dispatch packaged prompts in dependency-gated waves.
6. For each story: implementer completes, coordinator inspects, reviewer approves or findings loop
   reuses both contexts.
7. Commit approved story files and capture `STORY_COMMIT`.
8. Update the selected tracker row with `STORY_COMMIT`; commit only the tracker update and capture
   `TRACKER_COMMIT`.
9. Mark dependents ready only after both commits and worker closure.
10. Publish PR only when authorized; stop after URL unless review wait or merge was explicitly asked.

## 5. Test Cases

| Case | Covers | Modality | Scenario | Expected |
|---|---|---|---|---|
| TC-01 Trigger positive | R1, R2 | P | User explicitly invokes `$orchestrated-delivery` for a named execution package. | Skill activates and enforces Plan Mode/fallback before discovery. |
| TC-02 Trigger negative | R1 | P/T | User asks PR status, merge, typo fix, or `$plan-epic` work. | No orchestration machinery starts. |
| TC-03 Missing package | R3, R5 | P/T | `execution/plan.md` or `execution/tracker.md` is absent. | Refuse and hand to `$plan-delivery`; no scope invention. |
| TC-04 Missing readiness verdict | R4 | P/T | Package files exist but contain no deep review and readiness verdict. | Refuse; structural files alone do not pass. |
| TC-05 Incomplete prompt | R5, R6 | P/T | Implementer prompt lacks ACs, paths, verification, or mutation limits. | Refuse back to `$plan-delivery`; do not rewrite. |
| TC-06 Over-risk or underspecified item | R7 | P/T | Package item appears above `critical` or conflicts with frozen scope. | Refuse execution and name the required planning repair path. |
| TC-07 Tracker row completeness | R8 | S/P | Tracker row lacks reviewer verdict, gate evidence, commit hash, blockers, or model effort. | Package preflight fails. |
| TC-08 Runtime binding | R9, R10 | P | Complete package on a known surface. | Plan records surface mechanisms, provider profile, model class, planned/actual model, effort, cap, completion signal, and dependency commits without concrete IDs in generic files. |
| TC-09 Reviewer safeguard | R11 | P/E | Any story has a reviewer worker. | Reviewer class is `frontier-reviewer`; no weaker class is selected silently. |
| TC-10 Worker cap | R12 | P/T | Package has eight stories and cap is four. | All package stories remain; cap only throttles active sessions. |
| TC-11 Dependency readiness | R13, R19 | E/T | Consumer waits on producer. | Consumer does not launch until producer story commit, tracker evidence commit, and worker closure exist. |
| TC-12 Reuse contexts | R14 | E/T | Reviewer asks for changes. | Same implementer and reviewer are re-addressed; no fresh-per-round workers. |
| TC-13 Coordinator-only mutations | R15 | S/E | Inspect worker prompts and commit steps. | Workers are forbidden from staging, commits, PRs, merge, and closure. |
| TC-14 Advisory review | R16 | E/T | Reviewer approves a flawed or out-of-scope diff. | Coordinator catches the issue before commit. |
| TC-15 Story commit isolation | R17 | E/T | Worktree has approved story files plus unrelated edits. | Commit includes only approved story pathset after gate. |
| TC-16 Durable tracker commit | R18, R19 | E/T | Story is approved and committed. | Tracker records `STORY_COMMIT`, then a tracker-only commit exists before dependents unlock. |
| TC-17 Completion signal | R20 | E | Run subagent mode and visible-thread mode. | Subagents use native completion; visible-thread fallback treats filesystem events as wake only. |
| TC-18 Sparse communication | R21 | E | Long worker wait. | No filler wait narration, no fixed short polling, no transcript/diff dump. |
| TC-19 PR boundary | R22 | E | User asked to open a PR only. | Reports PR URL and stops; review wait/merge require explicit follow-up. |
| TC-20 Static integrity | R10, R23 | S | Inspect files. | YAML parses, references exist, provider IDs only in profiles, no contradictory prompt/tracker/scope policy, SKILL.md stays a router. |

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
