# Implement-Next Review and Analyzer Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make implement-next pre-PR review policy explicit and make `analyze-run` reconstruct PLD04-style review, verification, and merge evidence from event journals.

**Architecture:** The interactive skill remains the source of behavior instructions for human/agent runs. The TypeScript analyzer gains a pure event-summary layer that reads `events.ndjson`, normalizes legacy `ts` events with future `recordedAt`/`eventAt`, and derives review, verification, merge, and issue summaries without inventing missing session metrics.

**Tech Stack:** TypeScript, Vitest, Node fs/path APIs, Markdown skill/reference docs, generated JSON schema, esbuild MCP bundle.

---

### Task 1: Add analyzer red tests for interactive event reconstruction

**Files:**
- Modify: `packages/orchestrator/tests/analysis.test.ts`
- Modify: `test/run-analyzer.test.ts`

- [ ] **Step 1: Write the failing package-level analyzer test**

Add a test that creates `state.json` with `command: "implement-next"` and `interactive.sessionId:
null`, plus `events.ndjson` containing `pre_pr_review_downgraded`, `pre_pr_review_cleared`,
`pr_review_findings`, `pr_review_fix_batch`, `verification_passed`, `merged`, and `cleanup_complete`.
Assert that `analysis.review.prePr.status` is `downgraded`, `analysis.review.pr.findings` contains
the P2 finding, `fixBatchCount` is `1`, final verification and merge timestamps are present, and the
auto downgrade is listed in `issues`.

- [ ] **Step 2: Verify the red test fails**

Run:

```bash
pnpm --filter @agentic-workflow-kit/orchestrator test -- analysis
```

Expected: the new test fails because `review`, `verification`, `merge`, and `timeline` are absent.

- [ ] **Step 3: Write the root analyzer ordering test**

Add a root test that writes an interactive journal with `pr_review_fix_batch`, `merged`, then
`verification_passed` where `eventAt` makes merge happen first. Assert
`analysis.merge.mergeBeforeFinalVerification === true` and `issues` contains a merge/final
verification warning.

- [ ] **Step 4: Verify the red test fails**

Run:

```bash
pnpm vitest run test/run-analyzer.test.ts
```

Expected: the new assertion fails because merge sequencing is not implemented.

### Task 2: Implement event-derived analyzer summaries

**Files:**
- Modify: `packages/orchestrator/src/analysis/runAnalyzer.ts`

- [ ] **Step 1: Add output interfaces**

Extend `WorkflowRunAnalysis` with `review`, `verification`, `merge`, and `timeline` fields. Keep
existing fields unchanged.

- [ ] **Step 2: Parse and normalize events**

Implement `readEvents(runDirectory)`, `normalizeEvent(entry, index)`, and `eventTime(event)` helpers.
Use `eventAt` when present, then `ts`, then `recordedAt`, and sort by event time plus append index.

- [ ] **Step 3: Derive pre-PR review state**

Track requested mode from `config.resolved.json` when present and from event fields otherwise. Handle
`pre_pr_review_downgraded`, `pre_pr_review_blocked`, `pre_pr_review_findings`, and
`pre_pr_review_cleared`. Only set subagent status/agent id when an event says `actualMode:
"subagent"` or includes `agentId`.

- [ ] **Step 4: Derive PR review and verification state**

Collect `pr_review_findings`, count `pr_review_fix_batch` events, read `rerequestAfterFix` from
`config.resolved.json` or event fields, collect verification events, and identify the latest final
passed verification.

- [ ] **Step 5: Derive merge and issues**

Record merge and cleanup events. Add issues for pre-PR downgrade, pre-PR blocker, merge after review
fixes without final verification, and merge before final verification.

- [ ] **Step 6: Run analyzer tests green**

Run:

```bash
pnpm --filter @agentic-workflow-kit/orchestrator test -- analysis
pnpm vitest run test/run-analyzer.test.ts
```

Expected: both pass.

### Task 3: Tighten implement-next instructions and docs tests

**Files:**
- Modify: `skills/implement-next/SKILL.md`
- Modify: `references/config-schema.md`
- Modify: `test/skill-authoring.test.ts`
- Modify: `test/config-doc-sync.test.ts`

- [ ] **Step 1: Add failing docs contract assertions**

Assert that `implement-next` documents `pre_pr_review_blocked`, strict subagent fail-closed behavior,
the explicit delegation sentence, product/UI semantic checks, and merge-after-review-fix final gate.
Assert that `config-schema.md` documents local pre-PR loops separately from PR review gates.

- [ ] **Step 2: Verify docs tests fail**

Run:

```bash
pnpm vitest run test/skill-authoring.test.ts test/config-doc-sync.test.ts
```

Expected: new assertions fail.

- [ ] **Step 3: Update skill instructions**

Edit Phase 7, journal event lists, and Phase 10 so the skill explicitly defines `inline`, `auto`,
and `subagent`, records `pre_pr_review_blocked`, uses the recommended delegation wording, enforces
incremental loops, strengthens the review checklist, and records final verification completion before
merge.

- [ ] **Step 4: Update schema docs**

Clarify `review.prePr.mode`, `maxLoops`, and `loopMode`, add explicit delegation and analyzer
warning/blocker notes, and separate local review loops from `pr.review.rerequestAfterFix`.

- [ ] **Step 5: Run docs tests green**

Run:

```bash
pnpm vitest run test/skill-authoring.test.ts test/config-doc-sync.test.ts
```

Expected: tests pass.

### Task 4: Regenerate fixtures and runtime bundle

**Files:**
- Modify as generated: `references/config.schema.json` if schema generation changes output
- Modify as materialized: `plugins/agentic-workflow-kit/**`
- Modify as generated: `mcp/server.mjs`, `plugins/agentic-workflow-kit/mcp/server.mjs`

- [ ] **Step 1: Regenerate schema and bundle**

Run:

```bash
pnpm generate-schema
pnpm build:plugin-mcp
```

Expected: generated files are byte-synced with source.

- [ ] **Step 2: Sync plugin fixture**

Use the repo's existing sync/build output. If source docs changed but fixture docs did not update,
copy through the established build script output rather than hand-editing generated bundle content.

- [ ] **Step 3: Run drift and bundle tests**

Run:

```bash
pnpm vitest run test/plugin-runtime-bundle.test.ts packages/orchestrator/tests/schema-drift.test.ts
```

Expected: tests pass.

### Task 5: Full verification, cleanup, and PR

**Files:**
- Delete in final state: `docs/superpowers/specs/2026-06-10-implement-next-review-analyzer-hardening-design.md`
- Delete in final state: `docs/superpowers/plans/2026-06-10-implement-next-review-analyzer-hardening.md`
- Modify durable docs as needed: `docs/architecture.md`, `docs/getting-started.md`, or `references/config-schema.md`

- [ ] **Step 1: Run full gate**

Run:

```bash
pnpm check
```

Expected: lint, typecheck, root tests, and orchestrator tests pass.

- [ ] **Step 2: Remove transient spec and plan**

Delete the two `docs/superpowers/` working artifacts after their durable content is folded into
canonical docs.

- [ ] **Step 3: Re-run final focused checks if cleanup touched docs**

Run:

```bash
pnpm vitest run test/skill-authoring.test.ts test/config-doc-sync.test.ts test/run-analyzer.test.ts
```

Expected: tests pass.

- [ ] **Step 4: Commit, push, and open PR**

Use conventional commits and a reviewer-friendly PR body that explains the PLD04 motivation, behavior
changes, analyzer output changes, and verification commands.
