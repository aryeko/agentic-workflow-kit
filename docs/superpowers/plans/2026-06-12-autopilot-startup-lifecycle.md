# Autopilot Startup Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bounded child startup lifecycle so orphaned Codex child shells do not block workflow-autopilot retries forever.

**Architecture:** Introduce an explicit `requested` and `startup_failed` launch state plus `childStartupTimeoutMs`. The runner records launch intent before the MCP call, promotes to active `launched` on session/progress acknowledgement, serializes startup acknowledgement while preserving execution parallelism, and lets duplicate/analyzer paths classify stale startup orphans safely.

**Tech Stack:** TypeScript, Zod config schema, Vitest, Markdown docs, Changesets, Codex plugin fixture mirror.

---

## File Map

- `packages/orchestrator/src/types.ts`: add `startup_failed` and `requested` launch statuses, resolved config field, and startup classification fields if needed.
- `packages/orchestrator/src/config/schema.ts`: add `childStartupTimeoutMs` default.
- `packages/orchestrator/src/config/configLoader.ts`: resolve `childStartupTimeoutMs` in full and cwd-only configs.
- `packages/orchestrator/src/runner/WorkflowRunner.ts`: split launch request from session acknowledgement, add startup timeout, serialize run-eligible startup handshakes, emit startup events, and release safe tracker claims.
- `packages/orchestrator/src/runner/DuplicateLaunchGuard.ts`: classify stale startup artifacts with startup timeout and worktree activity evidence.
- `packages/orchestrator/src/analysis/runAnalyzer.ts`: classify startup pending/stale/failed children and expose startup evidence in child summaries.
- `packages/orchestrator/tests/runner.test.ts`: regression tests for startup timeout, serialized acknowledgement, linked child behavior, duplicate stale retry, and tracker release.
- `packages/orchestrator/tests/analysis.test.ts`: regression tests for startup-stale/orphan analyzer classification.
- `packages/orchestrator/tests/config-loader.test.ts`, `test/config-schema.test.ts`, `test/config-doc-sync.test.ts`: config/schema/docs assertions.
- `references/config-schema.md`, `docs/architecture.md`, `docs/getting-started.md`, `docs/test-plan/common-phases.md`, `skills/workflow-autopilot/SKILL.md`: canonical docs.
- `presets/*.yaml`: fully populated presets.
- `plugins/agentic-workflow-kit/**`: mirrored fixture copies for changed plugin sources.
- `references/config.schema.json` and mirrored schema: generated schema output.
- `.changeset/*.md`: patch changeset for runtime behavior.

### Task 1: Config Contract

**Files:**
- Modify: `packages/orchestrator/src/config/schema.ts`
- Modify: `packages/orchestrator/src/config/configLoader.ts`
- Modify: `packages/orchestrator/src/types.ts`
- Modify: `packages/orchestrator/tests/config-loader.test.ts`
- Modify: `test/config-schema.test.ts`

- [ ] **Step 1: Add failing config tests**

Add assertions that default parsing and `loadResolvedConfig` expose `childStartupTimeoutMs: 60000`, and that explicit YAML overrides are preserved.

Run: `pnpm --filter @agentic-workflow-kit/orchestrator test -- config-loader.test.ts && pnpm test -- test/config-schema.test.ts`

Expected: fail because `childStartupTimeoutMs` is missing.

- [ ] **Step 2: Implement config field**

Add `DEFAULT_CHILD_STARTUP_TIMEOUT_MS = 60_000`, `orchestrator.childStartupTimeoutMs` in the Zod schema, resolved config, cwd-only config, and `ResolvedWorkflowConfig`.

- [ ] **Step 3: Verify config tests**

Run: `pnpm --filter @agentic-workflow-kit/orchestrator test -- config-loader.test.ts && pnpm test -- test/config-schema.test.ts`

Expected: pass.

### Task 2: Startup Lifecycle in Runner

**Files:**
- Modify: `packages/orchestrator/src/types.ts`
- Modify: `packages/orchestrator/src/runner/WorkflowRunner.ts`
- Modify: `packages/orchestrator/tests/runner.test.ts`

- [ ] **Step 1: Add failing runner tests**

Add tests for:

- launch record starts as `requested` and becomes `launched` after `session-linked`;
- an unacknowledged child fires `child-startup-timeout`, writes `status: "startup_failed"`, removes active state, and records `child-startup-failed`;
- `runEligible` does not start A002 until A001 emits `session-linked`, but A001 can remain running while A002 starts;
- DLD01/DLD02 shape: A001 orphan times out while A002 linked child can still complete after A001 startup failure handling.

Run: `pnpm --filter @agentic-workflow-kit/orchestrator test -- runner.test.ts`

Expected: fail because the runner writes `launched` immediately and has no startup timeout.

- [ ] **Step 2: Implement startup acknowledgement barrier**

Refactor `recordChildLaunch` to write `status: "requested"` and keep enough metadata for a prepared launch. In `executeChild`, track an acknowledgement promise resolved by `session-linked` or progress, start a separate startup timeout before the normal no-progress timeout, and promote launch status to `launched` only on acknowledgement.

- [ ] **Step 3: Serialize startup in `runEligible`**

Change `launchAvailable` so it starts each child one at a time and waits for startup acknowledgement or startup failure before attempting the next story. Keep acknowledged child promises in the active pool so execution still runs concurrently up to `maxParallel`.

- [ ] **Step 4: Implement safe tracker release**

When startup fails before acknowledgement, release the row only if the owner is `awk:<runId>:<storyId>` and the status is still the configured in-progress status. Restore the story's previous eligible status and record `tracker-claim-released`.

- [ ] **Step 5: Verify runner tests**

Run: `pnpm --filter @agentic-workflow-kit/orchestrator test -- runner.test.ts`

Expected: pass.

### Task 3: Duplicate Guard Stale Startup Recovery

**Files:**
- Modify: `packages/orchestrator/src/runner/DuplicateLaunchGuard.ts`
- Modify: `packages/orchestrator/src/runner/WorkflowRunner.ts`
- Modify: `packages/orchestrator/tests/runner.test.ts`

- [ ] **Step 1: Add failing duplicate retry tests**

Add a historical `children/WK001.launch.json` with `status: "launched"` or `status: "requested"`, old `startedAt`, null session/progress/heartbeat, and no child result. Assert the new run ignores it and starts the story. Add a live recent launch test that still blocks.

Run: `pnpm --filter @agentic-workflow-kit/orchestrator test -- runner.test.ts`

Expected: stale orphan test fails because the duplicate guard blocks.

- [ ] **Step 2: Implement stale-aware classification**

Pass `now`, `childStartupTimeoutMs`, and the artifact store or filesystem paths needed for worktree activity checks into `findDuplicateLaunch`. Treat old unacknowledged records as stale startup orphans and return ignored evidence to the runner.

- [ ] **Step 3: Record ignored-stale evidence**

Have `preflightDuplicateLaunch` journal `child-launch-stale-ignored` with story id, duplicate story id, launch id, age, startup timeout, session/progress/result/worktree evidence, and reason.

- [ ] **Step 4: Verify duplicate tests**

Run: `pnpm --filter @agentic-workflow-kit/orchestrator test -- runner.test.ts`

Expected: pass.

### Task 4: Analyzer Startup Classification

**Files:**
- Modify: `packages/orchestrator/src/analysis/runAnalyzer.ts`
- Modify: `packages/orchestrator/tests/analysis.test.ts`
- Modify: `test/run-analyzer.test.ts` if CLI-facing snapshots need updated expectations.

- [ ] **Step 1: Add failing analyzer tests**

Add tests for:

- old unacknowledged launch-only child reports `status: "startup_stale"` or `startup_failed`, not `supervision_lost`;
- recent unacknowledged child reports `startup_pending`;
- linked or heartbeat child remains `launched`;
- diagnostic candidate with only `session_meta`/empty prompt is reported as an empty thread shell candidate when detectable from session roots.

Run: `pnpm --filter @agentic-workflow-kit/orchestrator test -- analysis.test.ts && pnpm test -- test/run-analyzer.test.ts`

Expected: fail where old launch-only children are still classified as `supervision_lost`.

- [ ] **Step 2: Implement analyzer classification**

Use `childStartupTimeoutMs` from `config.resolved.json`, falling back to `60000`, and classify launch-only children based on session id, session log, progress timestamps, worktree activity, result presence, and launch age.

- [ ] **Step 3: Verify analyzer tests**

Run: `pnpm --filter @agentic-workflow-kit/orchestrator test -- analysis.test.ts && pnpm test -- test/run-analyzer.test.ts`

Expected: pass.

### Task 5: Docs, Presets, Schema, Fixture Mirror, Changeset

**Files:**
- Modify: `references/config-schema.md`
- Modify: `docs/architecture.md`
- Modify: `docs/getting-started.md`
- Modify: `docs/test-plan/common-phases.md`
- Modify: `skills/workflow-autopilot/SKILL.md`
- Modify: `presets/gated-automerge.yaml`
- Modify: `presets/push-and-merge.yaml`
- Modify: `presets/push-only.yaml`
- Modify: `references/config.schema.json`
- Modify: `plugins/agentic-workflow-kit/**`
- Add: `.changeset/<slug>.md`
- Modify: `test/config-doc-sync.test.ts`

- [ ] **Step 1: Add failing doc/schema sync assertions**

Assert docs mention `childStartupTimeoutMs`, startup acknowledgement, startup orphan retry semantics, and the distinction between startup timeout and no-progress timeout.

Run: `pnpm test -- test/config-doc-sync.test.ts test/plugin-manifest.test.ts test/presets.test.ts`

Expected: fail until docs/presets/mirror are updated.

- [ ] **Step 2: Update canonical docs and presets**

Document startup lifecycle semantics and add `childStartupTimeoutMs: 60000` to all presets.

- [ ] **Step 3: Generate schema and mirror plugin fixture**

Run: `pnpm generate-schema`, then copy changed `.codex-plugin/`, `skills/`, `references/`, `presets/`, and `examples/` sources into `plugins/agentic-workflow-kit/` as required by the mirror tests.

- [ ] **Step 4: Add changeset**

Create a patch changeset for `@agentic-workflow-kit/orchestrator` describing bounded child startup and stale orphan retry recovery.

- [ ] **Step 5: Verify docs/fixture tests**

Run: `pnpm test -- test/config-doc-sync.test.ts test/plugin-manifest.test.ts test/presets.test.ts test/schema-drift.test.ts`

Expected: pass.

### Task 6: Final Verification and PR

**Files:**
- Remove before final commit: `docs/superpowers/specs/2026-06-12-autopilot-startup-lifecycle-design.md`
- Remove before final commit: `docs/superpowers/plans/2026-06-12-autopilot-startup-lifecycle.md`
- Commit all intended runtime/docs/test/fixture/changeset changes.

- [ ] **Step 1: Run full gates**

Run:

```bash
pnpm check
pnpm build
pnpm pack:dry-run
pnpm smoke:codex-plugin
```

Expected: all pass, or a precise external prerequisite is recorded.

- [ ] **Step 2: Confirm transient artifacts removed**

Run: `find docs/superpowers/specs docs/superpowers/plans -type f -not -name .gitkeep -print`

Expected: no files printed.

- [ ] **Step 3: Inspect diff and commit**

Run:

```bash
git diff --stat
git status --short
git add <intended files>
git commit -m "fix: harden autopilot child startup lifecycle"
```

Expected: one focused commit with no unrelated files.

- [ ] **Step 4: Push and open PR**

Run:

```bash
git push -u origin codex/autopilot-startup-lifecycle
gh pr create --title "Harden autopilot child startup lifecycle" --body-file <tmp-pr-body>
```

Expected: PR body includes motivation, root cause, changes, and verification evidence.
