---
title: agentic-workflow-kit redesign release-readiness review
status: review
owner: "—"
last-reviewed: 2026-06-14
related:
  - ./README.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/08-acceptance-criteria.md
  - ../../prds/agentic-workflow-kit-redesign/release-hardening-design.md
---

# agentic-workflow-kit redesign release-readiness review

A deep review of the redesign track conducted after AWK13 (canonical docs consolidation) and before
AWK14 (release readiness). Scope: the PRD and technical solution, the delivery track, and the
implemented orchestrator/runtime code. Every load-bearing claim below was verified against source at
the cited `file:line`. The fix plan is in
[release-hardening-design.md](../../prds/agentic-workflow-kit-redesign/release-hardening-design.md);
the work is sequenced as stories AWK13.1–AWK13.7, which block AWK14.

## Verdict

**Not ready to release — but the gap is specific and addressable, not a rewrite.** The build is green
(biome clean, `tsc` clean, **475 tests pass**: 178 root + 297 orchestrator). The Codex driver, the
budget engine, the tracker/migration machinery, the config schema, and the observability artifact
model are production-grade. The problem is concentrated in a small number of high-severity gaps,
chief among them that **the product's most dangerous action — autonomously merging to a GitHub
repo — is gated on regex over an agent's prose self-report rather than on verification of GitHub
state.**

Of 33 ship-blocker acceptance criteria, ~26 are genuinely met; 7 are checked off in the tracker but
satisfied only in letter (brittle prose-evidence, dead automation paths, or skill-instruction rather
than code gate). 5 of 10 quality bars are partially satisfied.

## Ground truth

| Gate | Result |
| --- | --- |
| `biome check .` | clean (109 files) |
| `tsc --noEmit` + orchestrator `typecheck` | clean |
| root `vitest` | 178 passed |
| orchestrator `vitest` | 297 passed |
| `pnpm smoke:codex-plugin` (not in `pnpm check`) | passes locally with codex 0.139.0; MCP-handshake only, not a real story run |
| orchestrator coverage | 82.6% stmt / 72.8% branch (project's own `vitest.config.ts` carries `TODO: ratchet to 90`) |

The green gate proves the wiring is internally consistent; it does **not** prove the safety-critical
decisions are correct, because the riskiest negative paths are untested (see Finding 6).

## Release blockers

### RB-1 — GitHub collaboration is prose-trust, not verification

**Criteria affected:** HC-3, RUN-4, RUN-6, Q-5, Q-7. **Fixed by:** AWK13.2.

The orchestrator makes **zero** GitHub API or `gh` CLI calls — a tree grep of
`packages/orchestrator/src` for `octokit|gh api|api.github|graphql|gh pr` returns nothing. PR
creation, CI waiting, review handling, merge, and branch deletion are delegated to the child Codex
session via a prose prompt (`drivers/codex-mcp/toolInput.ts:126`), and the parent recovers outcomes
by regex over the child's free-text final message — `checksFromContent` / `reviewFromContent` /
`mergeFromContent` in `drivers/codex-mcp/evidenceParser.ts:454`.

One guardrail is real and well-built: a claimed merge must be a git ancestor of `origin/<base>`
(`runner/CompletionGate.ts:164` → `isCommitReachableFromRef`), so a fabricated merge cannot pass the
gate. But **"CI passed" and "review approved" are only as trustworthy as a regex over what the agent
chose to say.** A child that asserts green CI but is wrong — or phrases it unusually — drives a green
completion and, under `pr.merge.auto: true`, a merge.

This cascades into recovery: because the parent never verifies remote-branch or PR state, it feeds
`RecoveryGuard` `remoteBranchExists: null`, which is hardcoded as a blocker
(`runner/RecoveryGuard.ts:48`). Verified: with null inputs the guard can essentially never return
`safe_to_take_over` — the automated-recovery path is effectively dead in V1 (conservative-safe, but
RUN-6's recoverable states for stale base / auth failure / merge conflict exist only if the child
volunteers them in prose).

This is a documented design choice (the technical solution scopes GitHub as child-owned with
"structured evidence extraction"), but it means HC-3/RUN-4/Q-7 are met in letter, not in spirit, and
Q-5 ("independently verify outcome metrics") is not met for CI/review.

### RB-2 — "Provider-neutral driver contract" is neutral in name only

**Criteria affected:** HC-2, Q-8. **Fixed by:** AWK13.1.

The `StoryRunner` interface (`drivers/StoryRunner.ts`) is clean, but Codex leaks through every layer
the design says must be host-agnostic:

- Recovery branches on a literal Codex error string — `/…Codex MCP request timed out/i`
  (`runner/WorkflowRunner.ts:1174`); a different driver's timeout silently bypasses supervision-lost
  handling.
- The abort/control command layer calls `sendCodexInterrupt` directly
  (`commands/handlers.ts:1402`); public tools are Codex-named (`codex_reply`, `codex_interrupt`,
  `check_codex_mcp`); `StoryRunner` has no `abort()`.
- Resolved config has a top-level `codex` namespace; the analyzer hardcodes `~/.codex/sessions`
  (`analysis/runAnalyzer.ts`); the artifact root is `.codex/agentic-workflow-kit`; the "generic"
  prompt is rendered inside the Codex driver and bakes in Codex instructions ("Do not mention
  @codex", `drivers/codex-mcp/toolInput.ts:203`).

Adding a second host today is a multi-domain breaking change — exactly what HC-2 exists to prevent.

### RB-3 — Run-state can corrupt under parallel autopilot

**Criteria affected:** Q-2 (durability). **Fixed by:** AWK13.3.

`appendEvent` does a bare `appendFile` per event with no serialization
(`artifacts/FileArtifactStore.ts:34`), called from concurrent un-awaited contexts (a `setInterval`
poll plus per-child lifecycle handlers). Under `maxParallel > 1` with large event payloads,
interleaved writes can produce malformed NDJSON. That compounds with load-bearing readers that
`JSON.parse` with no try/catch — `readControls` on the hot abort path (`runner/RunJournal.ts:122`)
and `readLaunchRecord` in the duplicate-launch preflight (`runner/DuplicateLaunchGuard.ts:156`). One
corrupt or half-written line breaks abort handling and the duplicate guard for the rest of the run.
The safe `{raw: line}` pattern already exists elsewhere in the codebase but was not applied to the
critical readers.

Related lower-confidence-but-real races in the same class: `abortRunHandler` and `WorkflowRunner`
both read-modify-write `state.json` with no lock (`commands/handlers.ts:411`); `claimTrackerRow` is a
check-then-act TOCTOU for `git.strategy: branch` parallel runs.

### RB-4 — Release mechanics are genuinely undone

**Criteria affected:** release prep. **Fixed by:** AWK14 (with stale-doc fixes pulled into AWK13.7).

- `.changeset/` holds only `config.json` + `README.md` — `changeset publish` is a no-op. (Expected:
  AWK14 is deferred precisely for this; called out here so it is not forgotten.)
- Root `CHANGELOG.md` is frozen at `## [0.1.0] - Unreleased` while the package is `0.5.14` with 14
  published releases. AWK13 scoped this file and missed it. It does not ship in the npm tarball
  (`files: ["dist"]`), but it is the first thing a repo browser reads.
- `SECURITY.md` supported-versions table says `0.1.x` (should be `0.5.x`) — also an AWK13 miss, and
  this one tells users the current line is unsupported for security fixes.

## High-priority findings

### H-1 — `trackerMigration` capability advertised as unavailable

**Fixed by:** AWK13.4. Migration is fully implemented and tested, but the facade hardcodes
`trackerMigration: false` (`api/facade.ts:561`), so orchestrating agents skip a working path
(TRK-2). The API contract says unavailable capabilities must be explicit in results — here an
available one is mis-reported. One-line fix plus a test asserting the full capability set.

### H-2 — Test trust gaps

**Fixed by:** AWK13.6. The untested paths are the dangerous ones: the merge gate rejecting a
**non-ancestor** merge (the test fake's `isCommitReachableFromRef` can only return `true`,
`tests/completion-gate.test.ts`), the real-git ancestry adapter (`git/GitInspector.ts`
`isCommitReachableFromRef` / `readFileFromRef` / `refreshBaseBranch` — zero tests), operator-abort
interrupting a live in-process child, malformed NDJSON readers, the concurrent tracker-claim race,
and every RUN-6 failure-mode state. There is no end-to-end story-run test (the codex smoke test only
checks the MCP handshake). Coverage 82.6%/72.8% is below the project's own deferred 90% target.

### H-3 — Files exceed the repo's 800-line cap; one god-module

**Fixed by:** AWK13.5. `commands/handlers.ts` (1605, mixing ~10 responsibilities),
`analysis/runAnalyzer.ts` (1452), `runner/WorkflowRunner.ts` (1236, with a ~260-line `executeChild`),
`tracks/markdownTracker.ts` (1029). The repo standard is 200–400 typical, 800 max.

### H-4 — Conservative defaults are skill instruction, not code gate

**Fixed by:** AWK13.4. POL-1/Q-10 require explicit approval before non-dry-run launch. The MCP
`dryRun` default is `true` and the autopilot skill says to dry-run first, but there is no runtime
approval gate — a caller passing `dryRun:false` launches immediately; the preflight-approval flag
from the API design is unimplemented. `workflow-init` can also auto-select an auto-merging preset for
a new repo with CI.

## Medium / DevX findings

**Fixed by:** AWK13.4 (correctness) and AWK13.7 (docs/DevX).

- `docs/getting-started.md:165` uses bare `agentic-workflow-kit …` for 3 commands while the rest of
  the guide uses `pnpm agentic-workflow-kit -- …`; in the repo-checkout context the guide assumes,
  the bare form is `command not found`.
- No `engines` field in either `package.json` despite Node 24 asserted in the README badge,
  CONTRIBUTING, orchestrator README, and CI.
- Path-config fields (`tracksDir` etc., also CLI/MCP-overridable) are not validated against `..`
  traversal the way `worktreeDir` is.
- `analyzeRunHandler` returns `Promise<unknown>`, discarding the typed `WorkflowRunAnalysis`
  (`commands/handlers.ts:361`).
- The in-run tracker parse path throws on a malformed row (`tracks/markdownTracker.ts:467`); a
  mid-run invalid edit can take down the whole supervision loop instead of blocking one story.
- `workflow-autopilot` SKILL lists a stale subset of MCP tools (omits `watch_run_start/poll/stop`,
  `codex_reply/interrupt`, and the `workflow_*` facade).

## What is genuinely solid

Do not redo these:

- **Codex MCP driver (HC-1)** — real stdio MCP client, session linkage, structured output,
  transient-only retries, layered timeouts, abort propagation.
- **Budgets (POL-4/5/6)** — real enforcement, not theater: warn < stop-launching < checkpoint-stop <
  abort, observed-vs-configured written to `budgets.json` each checkpoint, unavailable fields
  honestly null-with-reason. Tested end-to-end.
- **Merge-ancestry completion gate** — the one place GitHub trust is git-verified.
- **Config schema** (Zod + generated JSON schema + drift test), **tracker contract / validation /
  migration logic**, **ChildWorkspacePreparer path-safety**, and the **observability artifact model**
  (schema-versioned `summary.json` / `rows.json`).
- **Docs accuracy** — every CLI command, all 23 MCP tool names, and config keys cross-check clean
  against source. `pack:dry-run` clean; version sync consistent at 0.5.14; `claude plugin validate`
  passes. AWK13 consolidation largely succeeded (transient specs/plans drained, no broken links).

## Criteria scorecard

| Group | Fully met | Partial / at risk |
| --- | --- | --- |
| WF (1–5) | WF-1..5 | — |
| TRK (1–4) | TRK-1, TRK-3, TRK-4 | TRK-2 (capability flag) |
| RUN (1–6) | RUN-1, RUN-2, RUN-3, RUN-5 | RUN-4, RUN-6 |
| POL (1–7) | POL-2, POL-3, POL-4, POL-5, POL-6, POL-7 | POL-1 |
| OBS (1–7) | OBS-2, OBS-3, OBS-4, OBS-5, OBS-6 | OBS-1, OBS-7 (target) |
| HC (1–4) | HC-1, HC-4 | HC-2, HC-3 |
| FUT (1–2) | FUT-1, FUT-2 | — |
| Quality bars | Q-1, Q-3, Q-4, Q-6, Q-9 | Q-2, Q-5, Q-7, Q-8, Q-10 |

## Recommended path to release

1. Land AWK13.1 (provider-neutral boundary) — foundational seams the other fixes build on.
2. Land AWK13.2 (GitHub verification + recovery) — the headline blocker.
3. Land AWK13.3 (run-state durability), AWK13.4 (safety defaults + API/input fidelity).
4. Land AWK13.5 (module decomposition), then AWK13.6 (test trust + coverage ratchet) and AWK13.7
   (stale docs + DevX hygiene).
5. Then AWK14: consolidated changeset, regenerated changelog, release handoff.

## Method

Reviewed across four dimensions (spec compliance, code/architecture, test trust, docs/DevX/packaging)
with parallel agents, then verified each release-blocker and high finding directly against source.
Citations are to `main` at commit `e386325`.
