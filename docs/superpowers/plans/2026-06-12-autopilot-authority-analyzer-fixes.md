# Autopilot Authority And Analyzer Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix workflow-kit autopilot supervision, completion-authority, MCP launch, and analyzer reporting issues exposed by the SSS02/SSS04 Pathway run.

**Architecture:** Keep the existing `WorkflowRunner`, `CompletionGate`, `CodexMcpStoryRunner`, and `runAnalyzer` boundaries. Add small contract fields and focused helper functions instead of replacing the runtime. Runtime completion remains tracker/git based; analyzer may use child evidence to explain stale snapshots.

**Tech Stack:** TypeScript, Vitest, Node fs/git helpers, MCP server tool handlers, Markdown tracker parser.

---

## File Structure

- Modify `packages/orchestrator/src/types.ts` for child progress and structured result types.
- Modify `packages/orchestrator/src/drivers/StoryRunner.ts` for structured result metadata.
- Modify `packages/orchestrator/src/drivers/codex-mcp/CodexMcpStoryRunner.ts` to extract structured child results.
- Modify `packages/orchestrator/src/runner/WorkflowRunner.ts` for progress semantics and async initial launch.
- Modify `packages/orchestrator/src/runner/CompletionGate.ts` and `packages/orchestrator/src/git/GitInspector.ts` for base tracker authority.
- Modify `packages/orchestrator/src/commands/handlers.ts` and `packages/orchestrator/src/mcp/tools.ts` for MCP async launch.
- Modify `packages/orchestrator/src/analysis/runAnalyzer.ts` for per-story evidence and stale snapshot reporting.
- Modify `packages/orchestrator/tests/runner.test.ts`, `packages/orchestrator/tests/analysis.test.ts`, and MCP tests for regression coverage.
- Modify canonical docs and mirror skill/reference files.

### Task 1: Child Progress Contract

- [ ] Add `lastSupervisorPollAt`, `lastObservedChildProgressAt`, and `progressSource` to active child launch types while keeping `lastHeartbeatAt` readable for legacy artifacts.
- [ ] Write a failing runner test that fires the supervisor interval, then fires the original no-progress timeout and expects `supervision_lost`.
- [ ] Replace `child-heartbeat` timer behavior with `child-supervisor-poll`; do not refresh no-progress timeout from that poll.
- [ ] Keep session linkage and MCP progress as observed child progress and update `lastObservedChildProgressAt`.
- [ ] Run `pnpm --filter @agentic-workflow-kit/orchestrator test -- runner.test.ts`.

### Task 2: Structured Child Results And Base Tracker Authority

- [ ] Add a `ChildResultEvidence` type and optional `evidence` field on `StoryRunResult` / `SettledStoryRun`.
- [ ] Write a failing completion test where local story snapshots remain `implementing`, child evidence says PR merged, and `git show origin/main:<tracker>` returns a done row.
- [ ] Extend `GitInspector` with `readFileFromRef(cwdAbs, ref, filePath)` and implement it in `RealGitInspector`.
- [ ] Add a parser helper that reads one story from base tracker markdown with existing `parseTrackerStories`.
- [ ] In `CompletionGate`, when local tracker status is incomplete and PR auto-merge or merged evidence is present, read `origin/<baseBranch>` tracker content and evaluate the base story row.
- [ ] Record completion authority source in child artifacts and events.
- [ ] Run focused runner/completion tests.

### Task 3: MCP Async Launch

- [ ] Add an internal run option for returning after initial launch.
- [ ] Refactor `WorkflowRunner.runEligible` and `runStory` enough to return initial `running` state while background supervision continues for MCP calls.
- [ ] Add handler/MCP tests that non-dry-run tools return `running` with `runId` and `artifactDir` without waiting for child completion.
- [ ] Update MCP tool descriptions to require `watch_run` / `analyze_run` for supervision.
- [ ] Run MCP and handler tests.

### Task 4: Analyzer SSS Regression Coverage

- [ ] Write a minimized SSS02/SSS04-shaped analyzer fixture in a test: blocked parent state, stale after snapshots, settled children with merged PR evidence, one supervisor poll, and per-story review/verification text.
- [ ] Assert analyzer reports stale parent snapshot versus merged/base authority, per-story verification/merge/review summaries, and no child progress from supervisor poll.
- [ ] Update `runAnalyzer` to compute per-story evidence first and keep aggregate fields as compatibility summaries.
- [ ] Run analyzer tests.

### Task 5: Docs And Mirrors

- [ ] Update `docs/architecture.md`, `docs/getting-started.md`, and `docs/test-plan/README.md`.
- [ ] Update `skills/workflow-autopilot/SKILL.md` and `skills/implement-next/SKILL.md`.
- [ ] Mirror changed skills/references into `plugins/agentic-workflow-kit/`.
- [ ] Remove transient spec/plan files after durable docs are updated.
- [ ] Run mirror/schema tests.

### Task 6: Full Verification And PR

- [ ] Run `pnpm check`.
- [ ] Run `pnpm build`.
- [ ] Run `pnpm pack:dry-run`.
- [ ] Run `pnpm smoke:codex-plugin`.
- [ ] Run `claude plugin validate .` if available.
- [ ] Commit, push, and open a PR with summary and verification evidence.

