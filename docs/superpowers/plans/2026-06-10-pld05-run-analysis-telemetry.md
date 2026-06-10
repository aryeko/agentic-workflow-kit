# PLD05 Run Analysis Telemetry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix PLD05-style `implement-next` run analysis, event contracts, review scope guidance, docs, tests, and plugin fixtures.

**Architecture:** Keep `events.ndjson` as the audit contract. Add analyzer normalization for canonical events plus recent aliases, preserve file-order timeline evidence, and make `RunJournal.record()` write `recordedAt`/`eventAt` by default. Update skills/docs so future journals emit unambiguous review completion and PR lifecycle events.

**Tech Stack:** TypeScript, Vitest, Markdown plugin skills/docs, generated bundled MCP fixture.

---

### Task 1: Analyzer Regression Tests

**Files:**
- Modify: `test/run-analyzer.test.ts`

- [ ] **Step 1: Add a PLD05-style failing test**

Add a test that writes a temporary run with:

- `pre_pr_review_blocked` with `findings`
- two `pre_pr_review_fix_batch_applied` events
- `pre_pr_review_passed`
- `codex_pr_review_thread_resolved`
- `pr_merged`
- `state.interactive.sessionId: null`

Assert:

- no duplicate `pre-PR review blocked` issues
- `review.prePr.status === "passed"`
- two local loops with findings plus pass
- `review.prePr.fixBatchCount === 2`
- `review.pr.fixBatchCount === 1`
- `review.pr.resolvedThreadCount === 1`
- `merge.merged === true`
- timeline index order remains journal order
- child session linkage is unavailable, not fabricated

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm test -- test/run-analyzer.test.ts`

Expected: FAIL because aliases are not interpreted yet.

### Task 2: Analyzer Event Normalization

**Files:**
- Modify: `packages/orchestrator/src/analysis/runAnalyzer.ts`
- Modify: `test/run-analyzer.test.ts`

- [ ] **Step 1: Normalize local review aliases**

Implement helper predicates so:

- `pre_pr_review_completed` with `verdict: "BLOCK"` or findings creates a findings loop.
- `pre_pr_review_completed` with `verdict: "PASS"` creates a pass loop.
- `pre_pr_review_blocked` with findings is treated as a legacy findings loop.
- `pre_pr_review_blocked` without findings remains execution blocked.
- `pre_pr_review_passed` maps to pass.
- `pre_pr_review_fix_batch_applied` increments local fix batches.

- [ ] **Step 2: Normalize PR review and merge aliases**

Implement handling so:

- `pr_review_fix_batch_started`, `pr_review_fix_batch_applied`, `pr_review_fix_batch`, and `pr_review_fix_pushed` count as PR fix batches.
- `codex_pr_review_thread_resolved` and `pr_review_thread_resolved` increment resolved thread count and count as PR follow-up.
- `pr_merged` maps to merged.

- [ ] **Step 3: Deduplicate analyzer issues**

Introduce stable issue keys internally and return unique issue messages.

- [ ] **Step 4: Preserve file-order timeline evidence**

Return `timeline` in journal order by `index`, while keeping `eventAt` and `recordedAt` for consumers that need chronological sorting.

- [ ] **Step 5: Run focused tests**

Run: `pnpm test -- test/run-analyzer.test.ts`

Expected: PASS.

### Task 3: Runtime Timestamp Contract

**Files:**
- Modify: `packages/orchestrator/src/runner/RunJournal.ts`
- Modify: `test/run-journal.test.ts` or nearest existing runner test

- [ ] **Step 1: Write a failing journal timestamp test**

Test that `RunJournal.record("example", { eventAt: "external" })` writes:

- `recordedAt` from the journal clock
- supplied `eventAt` only when explicit
- no legacy-only `ts` field

- [ ] **Step 2: Implement default timestamping**

Update `RunJournal.record()` to set `recordedAt` to `clock.now()` and `eventAt` to supplied `eventAt` or the same `recordedAt`.

- [ ] **Step 3: Run focused tests**

Run: `pnpm test -- test/run-journal.test.ts test/run-analyzer.test.ts`

Expected: PASS.

### Task 4: Skill and Documentation Contract

**Files:**
- Modify: `skills/implement-next/SKILL.md`
- Modify: `references/config-schema.md`
- Modify: `docs/architecture.md`
- Modify: `docs/test-plan/common-phases.md`
- Modify: plugin fixture mirrors under `plugins/agentic-workflow-kit/`
- Modify: relevant authoring/docs sync tests if needed

- [ ] **Step 1: Document canonical events**

Update skill docs to prefer:

- `pre_pr_review_started`
- `pre_pr_review_completed` with `verdict`, `mode`, `agentId`, `loop`, `findings`, and `summary`
- `pre_pr_review_fix_batch_applied`
- `pr_review_started`
- `pr_review_findings`
- `pr_review_fix_batch_started`
- `pr_review_fix_batch_applied`
- `pr_review_thread_resolved`
- `pr_review_completed`
- `pr_merged`

- [ ] **Step 2: Clarify loop semantics**

Document `implement.review.prePr.maxLoops` as maximum local review fix batches before stopping/escalating.

- [ ] **Step 3: Add scope guard for review agents**

Update pre-PR review instructions to require product/docs/story/spec/plan compliance, treat story boundaries as authoritative, avoid visible UI requests for telemetry unless explicitly required, and flag out-of-scope UI additions.

- [ ] **Step 4: Mirror plugin fixture**

Copy changed `skills/`, `references/`, `presets/`, and `examples/` surfaces into `plugins/agentic-workflow-kit/` or run the repo's sync command if available.

### Task 5: Verification and PR

**Files:**
- Generated: `mcp/server.mjs`
- Generated: `plugins/agentic-workflow-kit/mcp/server.mjs`

- [ ] **Step 1: Run generators**

Run: `pnpm build:plugin-mcp`

- [ ] **Step 2: Run standard and plugin checks**

Run:

```bash
pnpm check
pnpm build
pnpm pack:dry-run
pnpm smoke:codex-plugin
```

- [ ] **Step 3: Compare analyzer before/after**

Run: `pnpm --silent agentic-workflow-kit -- analyze-run /Users/aryekogan/repos/pathway/.codex/agentic-workflow-kit/runs/2026-06-10T19-29-14Z --json`

Expected: no false pre-PR execution blocker, review passed, local fix loops counted, PR thread/merge recognized.

- [ ] **Step 4: Commit and open PR**

Commit with conventional messages and open a ready PR against `aryeko/agentic-workflow-kit` with a title/body explaining the PLD05 analyzer failure, actual successful flow, runtime/analyzer/doc changes, and verification.
