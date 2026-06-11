# Autopilot Recovery Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `workflow-autopilot` preserve live child session evidence, avoid unsafe recovery, and produce analyzable full PR/review/merge runs.

**Architecture:** Extend the existing `StoryRunner` boundary with lifecycle callbacks, split supervision timeout into no-progress and wall-clock limits, add structured recovery/completion authority evidence, and keep analyzer/docs/plugin fixtures in sync. Keep the tracker as the completion source, but make merged-PR authority explicit when a story already landed on the configured base branch.

**Tech Stack:** TypeScript, Vitest, Zod config schema, markdown docs, generated JSON Schema, package-backed MCP bundle.

---

## File Structure

- Modify `packages/orchestrator/src/drivers/StoryRunner.ts`: add optional child lifecycle callbacks and progress event types.
- Modify `packages/orchestrator/src/drivers/codex-mcp/CodexMcpStoryRunner.ts`: forward MCP progress notifications and final thread metadata through callbacks.
- Modify `packages/orchestrator/src/runner/WorkflowRunner.ts`: persist lifecycle metadata immediately, reset no-progress timeout on progress, keep max wall-clock timeout, and record completion authority events.
- Create `packages/orchestrator/src/runner/RecoveryGuard.ts`: structured mutation guard for child takeover decisions.
- Modify `packages/orchestrator/src/runner/CompletionGate.ts`: return `authority` with completion/blocked decisions.
- Modify `packages/orchestrator/src/analysis/runAnalyzer.ts`: expose per-child linkage, review, recovery, and completion authority details.
- Modify `packages/orchestrator/src/types.ts`: add timeout config fields and artifact/analysis type fields.
- Modify `packages/orchestrator/src/config/schema.ts` and `packages/orchestrator/src/config/configLoader.ts`: add `childNoProgressTimeoutMs` and `childMaxRuntimeMs`, retaining `childTimeoutMs` as a compatibility alias/default.
- Modify `packages/orchestrator/src/drivers/codex-mcp/toolInput.ts` and `skills/implement-next/SKILL.md`: add preflight, review packet, failed-spawn validation, PR fix-batch, and rendered-verification downgrade instructions.
- Modify `references/config-schema.md`, `docs/getting-started.md`, `docs/architecture.md`, and `docs/test-plan/common-phases.md`: document timeout, recovery, analyzer, review, and rendered verification behavior.
- Mirror changed plugin files to `plugins/agentic-workflow-kit/`.
- Update tests in `packages/orchestrator/tests/runner.test.ts`, `packages/orchestrator/tests/completion-gate.test.ts`, `packages/orchestrator/tests/analysis.test.ts`, `packages/orchestrator/tests/codex-mcp-runner.test.ts`, `test/config-schema.test.ts`, `test/config-doc-sync.test.ts`, `test/skill-authoring.test.ts`, and `test/plugin-manifest.test.ts`.
- Add `.changeset/autopilot-recovery-hardening.md`.

## Task 1: Config Timeout Split

**Files:**
- Modify: `packages/orchestrator/src/config/schema.ts`
- Modify: `packages/orchestrator/src/config/configLoader.ts`
- Modify: `packages/orchestrator/src/types.ts`
- Modify: `presets/*.yaml`
- Modify: `references/config-schema.md`
- Test: `test/config-schema.test.ts`
- Test: `packages/orchestrator/tests/config-loader.test.ts`
- Test: `test/config-doc-sync.test.ts`

- [ ] **Step 1: Write failing config tests**

Add assertions that default config resolves:

```ts
expect(parsed.orchestrator.childNoProgressTimeoutMs).toBe(1_800_000);
expect(parsed.orchestrator.childMaxRuntimeMs).toBe(7_200_000);
```

Add compatibility assertions that a config with only `childTimeoutMs: 60000` resolves
`childNoProgressTimeoutMs` to `60000` and leaves `childMaxRuntimeMs` at the default.

- [ ] **Step 2: Run red tests**

Run:

```bash
pnpm vitest run test/config-schema.test.ts packages/orchestrator/tests/config-loader.test.ts test/config-doc-sync.test.ts
```

Expected: fail because the new timeout fields do not exist yet.

- [ ] **Step 3: Implement schema/load defaults**

Add schema fields:

```ts
childTimeoutMs: z.number().int().min(1).optional(),
childNoProgressTimeoutMs: z.number().int().min(1).optional(),
childMaxRuntimeMs: z.number().int().min(1).default(7_200_000),
```

Resolve `childNoProgressTimeoutMs` from CLI override, explicit `childNoProgressTimeoutMs`, legacy
`childTimeoutMs`, then `1_800_000`. Keep `childTimeoutMs` on the resolved type as the compatibility
alias for existing callers.

- [ ] **Step 4: Run green tests**

Run the same focused test command and expect pass.

## Task 2: Child Lifecycle and Timeout Supervision

**Files:**
- Modify: `packages/orchestrator/src/drivers/StoryRunner.ts`
- Modify: `packages/orchestrator/src/drivers/codex-mcp/CodexMcpStoryRunner.ts`
- Modify: `packages/orchestrator/src/runner/RunJournal.ts`
- Modify: `packages/orchestrator/src/runner/WorkflowRunner.ts`
- Test: `packages/orchestrator/tests/runner.test.ts`
- Test: `packages/orchestrator/tests/codex-mcp-runner.test.ts`

- [ ] **Step 1: Write failing lifecycle tests**

Add a fake runner that calls:

```ts
request.onLifecycle?.({ type: 'session-linked', sessionId: 'thread-a001', sessionLogPath: '/sessions/a001.jsonl' });
request.onLifecycle?.({ type: 'progress', message: 'opened PR #91' });
```

Assert `children/A001.launch.json` is updated with `sessionId` before the child resolves and that a
`child-progress` event resets the no-progress timer.

- [ ] **Step 2: Run red tests**

Run:

```bash
pnpm --filter @agentic-workflow-kit/orchestrator test -- packages/orchestrator/tests/runner.test.ts packages/orchestrator/tests/codex-mcp-runner.test.ts
```

Expected: fail because `onLifecycle` and split timers do not exist.

- [ ] **Step 3: Implement lifecycle callbacks**

Add `ChildLifecycleEvent` and `onLifecycle` to `StoryRunRequest`. In `WorkflowRunner.executeChild`,
handle `session-linked` by calling `RunJournal.updateChildLaunch()` immediately and handle
`progress` by recording `child-progress`, updating `lastHeartbeatAt`, and refreshing the
no-progress timeout.

- [ ] **Step 4: Implement timeout split**

Use one timeout for `childNoProgressTimeoutMs` and one timeout for `childMaxRuntimeMs`. Progress
resets only the no-progress timer. Max runtime remains absolute.

- [ ] **Step 5: Forward Codex progress**

In `CodexMcpStoryRunner`, pass an MCP progress callback when supported and emit a final
`session-linked` lifecycle event as soon as `structuredContent.threadId` is validated.

- [ ] **Step 6: Run green tests**

Run the same focused command and expect pass.

## Task 3: Recovery Guard and Completion Authority

**Files:**
- Create: `packages/orchestrator/src/runner/RecoveryGuard.ts`
- Modify: `packages/orchestrator/src/runner/CompletionGate.ts`
- Modify: `packages/orchestrator/src/runner/WorkflowRunner.ts`
- Modify: `packages/orchestrator/src/git/GitInspector.ts` if evidence fields need widening
- Test: `packages/orchestrator/tests/runner.test.ts`
- Test: `packages/orchestrator/tests/completion-gate.test.ts`

- [ ] **Step 1: Write failing guard/authority tests**

Add tests that:

- completion returns authority `merged-pr-on-base` for complete tracker status plus merge evidence,
- completion returns authority `forbidden-direct-base-commit` for unexplained direct base commits,
- recovery guard returns `manual_recovery_required` when session evidence or dirty worktree evidence
  is ambiguous.

- [ ] **Step 2: Run red tests**

Run:

```bash
pnpm --filter @agentic-workflow-kit/orchestrator test -- packages/orchestrator/tests/completion-gate.test.ts packages/orchestrator/tests/runner.test.ts
```

Expected: fail because authority/recovery details are missing.

- [ ] **Step 3: Implement authority**

Return `authority` from `CompletionGate.evaluate()` and persist it in settled child artifacts and
`completion-authority` events.

- [ ] **Step 4: Implement recovery guard**

Create a pure guard that accepts child launch/session evidence, branch/PR/merge evidence, tracker
status on base, latest commit, and worktree cleanliness. It returns `safe_to_take_over` only when
all liveness evidence is stale and the worktree is clean; otherwise it returns
`manual_recovery_required` with exact evidence strings.

- [ ] **Step 5: Run green tests**

Run the same focused command and expect pass.

## Task 4: Analyzer Details

**Files:**
- Modify: `packages/orchestrator/src/analysis/runAnalyzer.ts`
- Test: `packages/orchestrator/tests/analysis.test.ts`

- [ ] **Step 1: Write failing analyzer tests**

Add a synthetic run with:

- launch `sessionId: null`,
- diagnostic `session_candidate` event,
- failed `spawn_agent` call in a session log,
- `parent_takeover_started` and `parent_takeover_blocked` events,
- `completion_authority` event.

Assert per-child details expose linkage status, diagnostic candidates, failed spawn attempts,
subagent spawn/wait/close counts, recovery events, PR fix-batch policy, and completion authority.

- [ ] **Step 2: Run red tests**

Run:

```bash
pnpm --filter @agentic-workflow-kit/orchestrator test -- packages/orchestrator/tests/analysis.test.ts
```

Expected: fail because the per-child detail fields are absent.

- [ ] **Step 3: Implement analyzer fields**

Extend `AnalyzedChild` without removing existing fields. Derive details from events first and from
session logs when available. Keep launch-time/story/worktree matching labeled as diagnostic evidence.

- [ ] **Step 4: Run green tests**

Run the same focused command and expect pass.

## Task 5: Prompt and Docs Contracts

**Files:**
- Modify: `packages/orchestrator/src/drivers/codex-mcp/toolInput.ts`
- Modify: `skills/implement-next/SKILL.md`
- Modify: `references/config-schema.md`
- Modify: `docs/getting-started.md`
- Modify: `docs/architecture.md`
- Modify: `docs/test-plan/common-phases.md`
- Test: `test/skill-authoring.test.ts`
- Test: `test/config-doc-sync.test.ts`

- [ ] **Step 1: Write failing text tests**

Assert the prompt and skill mention:

- child preflight with cwd, git top-level, branch, expected worktree path, and base branch,
- validating `spawn_agent` payloads before calling,
- review packet includes product docs, architecture docs, story brief, spec, and plan,
- rendered verification fallback to Playwright/e2e gates,
- no Codex rerequest when `rerequestAfterFix: false`.

- [ ] **Step 2: Run red tests**

Run:

```bash
pnpm vitest run test/skill-authoring.test.ts test/config-doc-sync.test.ts
```

Expected: fail because the new contract strings are absent.

- [ ] **Step 3: Update prompt and docs**

Patch the child prompt, skill instructions, and canonical docs with the new user-facing workflow
behavior.

- [ ] **Step 4: Run green tests**

Run the same focused command and expect pass.

## Task 6: Fixture, Bundle, Changeset, and Verification

**Files:**
- Modify: `plugins/agentic-workflow-kit/**` mirrored files
- Modify: `references/config.schema.json`
- Modify: `plugins/agentic-workflow-kit/references/config.schema.json`
- Modify: `plugins/agentic-workflow-kit/mcp/server.mjs` after build
- Add: `.changeset/autopilot-recovery-hardening.md`

- [ ] **Step 1: Sync generated and materialized assets**

Run:

```bash
pnpm generate-schema
pnpm build:plugin-mcp
```

Then mirror changed `skills/`, `references/`, `presets/`, `examples/`, and `.codex-plugin/` files to
`plugins/agentic-workflow-kit/` as needed.

- [ ] **Step 2: Add changeset**

Create a patch changeset for `@agentic-workflow-kit/orchestrator` describing safer autopilot
supervision, recovery analysis, and prompt/docs contracts.

- [ ] **Step 3: Run full verification**

Run:

```bash
pnpm check
pnpm build
pnpm pack:dry-run
pnpm smoke:codex-plugin
```

If available, also run:

```bash
claude plugin validate .
```

- [ ] **Step 4: Commit, push, and open PR**

Commit implementation and changeset separately when practical. Push
`codex/workflow-autopilot-recovery-hardening` and open a PR summarizing fixed behavior, why it
matters, verification evidence, and remaining limitations.
