# Autopilot Remaining Operations Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish the remaining non-git operational hardening from the autopilot session analysis.

**Architecture:** Keep parent tracker claims as local locks that are released after settlement, make live metrics update from lifecycle events, enrich analysis from session-derived review loops, and add bounded wait polling to watch-run handlers shared by CLI and MCP.

**Tech Stack:** TypeScript, Vitest, pnpm, existing orchestrator runtime, MCP adapter, and CLI parser.

---

## Task 1: Parent Tracker Claim Release

**Files:**
- Modify `packages/orchestrator/src/runner/WorkflowRunner.ts`
- Modify `packages/orchestrator/src/runner/RunJournal.ts`
- Modify `packages/orchestrator/tests/runner.test.ts`

- [ ] Add a failing test where a worktree child settles while the parent tracker row is still `implementing` and owned by `awk:<run>:<story>`.
- [ ] Implement settled-claim release using existing `releaseTrackerClaim`.
- [ ] Record `tracker-claim-released` or `tracker-claim-release-skipped` events.
- [ ] Run `pnpm --filter @agentic-workflow-kit/orchestrator test -- packages/orchestrator/tests/runner.test.ts`.

## Task 2: Live Metrics And Session Paths

**Files:**
- Modify `packages/orchestrator/src/runner/MetricsCollector.ts`
- Modify `packages/orchestrator/src/runner/WorkflowRunner.ts`
- Modify `packages/orchestrator/tests/runner.test.ts`

- [ ] Add a failing test proving `metrics.live.json` contains a linked child `sessionLogPath` before settlement.
- [ ] Add a lightweight live child metrics upsert on session link/progress.
- [ ] Preserve final metrics merging when a runner returns richer metrics.
- [ ] Run the runner test suite.

## Task 3: Per-Child Review Reconstruction

**Files:**
- Modify `packages/orchestrator/src/analysis/runAnalyzer.ts`
- Modify `packages/orchestrator/tests/analysis.test.ts`

- [ ] Add a failing analyzer test where a child session contains review subagent output but child evidence review fields are null.
- [ ] Attach session-derived review loops to that child’s `review.prePr`.
- [ ] Keep aggregate review behavior unchanged.
- [ ] Run `pnpm --filter @agentic-workflow-kit/orchestrator test -- packages/orchestrator/tests/analysis.test.ts`.

## Task 4: Sparse Watch Mode

**Files:**
- Modify `packages/orchestrator/src/types.ts`
- Modify `packages/orchestrator/src/cli/args.ts`
- Modify `packages/orchestrator/src/commands/handlers.ts`
- Modify `packages/orchestrator/src/cli.ts`
- Modify `packages/orchestrator/src/mcp/tools.ts`
- Modify `packages/orchestrator/tests/cli-args.test.ts`
- Modify `packages/orchestrator/tests/mcp-server.test.ts`

- [ ] Add failing parser and handler tests for `watch-run --wait --interval-ms <n> --timeout-ms <n>`.
- [ ] Implement bounded polling in `watchRunHandler`.
- [ ] Add MCP input fields `wait`, `intervalMs`, and `timeoutMs`.
- [ ] Keep one-shot watch behavior unchanged.

## Task 5: Cleanup And Verification

**Files:**
- Modify `.changeset/autopilot-evidence-hardening.md` if needed
- Delete this spec and plan before final push

- [ ] Run focused suites.
- [ ] Run `pnpm check`.
- [ ] Spawn a review agent and fix blocking findings.
- [ ] Delete transient spec/plan and push the PR branch.
