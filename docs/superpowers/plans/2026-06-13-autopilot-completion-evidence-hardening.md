# Autopilot Completion Evidence Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden autopilot completion and analysis so the DLD05-shaped run reports child-worktree tracker completion, avoids false merge/smoke evidence, and surfaces actionable analyzer issues.

**Architecture:** Move legacy Codex child-output parsing into a focused evidence parser, then have completion and analysis consume normalized evidence with explicit authority and issue categories. Keep tracker state authoritative: child prose can supplement evidence, but completion must still come from tracker snapshots and git/PR evidence.

**Tech Stack:** TypeScript, Vitest, pnpm, Changesets, existing orchestrator runner/analyzer/MCP code.

---

## File Structure

- Create `packages/orchestrator/src/drivers/codex-mcp/evidenceParser.ts`: focused compatibility parser for Codex child text and structured child evidence.
- Modify `packages/orchestrator/src/drivers/codex-mcp/CodexMcpStoryRunner.ts`: delegate child-result evidence parsing to `evidenceParser.ts`.
- Modify `packages/orchestrator/src/runner/CompletionGate.ts`: read child worktree tracker evidence before generic parent-snapshot failure, and return PR-policy-specific incomplete authority when auto-merge has not produced merge/base evidence.
- Modify `packages/orchestrator/src/types.ts`: add normalized PR policy evidence and optional evidence fields used by analyzer/completion.
- Modify `packages/orchestrator/src/analysis/runAnalyzer.ts`: add issue classification for child-tracker mismatch, PR-policy incomplete, verification contradiction, false-positive merge guards, and external recovery.
- Modify `packages/orchestrator/src/mcp/tools.ts`: make `analyze_run` concise by default while keeping detailed output opt-in.
- Modify `packages/orchestrator/tests/completion-gate.test.ts`, `packages/orchestrator/tests/analysis.test.ts`, and add `packages/orchestrator/tests/evidence-parser.test.ts`: regression coverage.
- Modify `skills/workflow-autopilot/SKILL.md` and the materialized plugin copy under `plugins/agentic-workflow-kit/skills/workflow-autopilot/SKILL.md`: supervision guidance from the design.
- Add `.changeset/<slug>.md`: patch release note for orchestrator.
- Final cleanup: delete this plan and the transient spec from `docs/superpowers/` before PR, preserving durable behavior in tests, changeset, and skill guidance.

## Task 1: Extract And Harden Evidence Parser

**Files:**
- Create: `packages/orchestrator/src/drivers/codex-mcp/evidenceParser.ts`
- Create: `packages/orchestrator/tests/evidence-parser.test.ts`
- Modify: `packages/orchestrator/src/drivers/codex-mcp/CodexMcpStoryRunner.ts`
- Modify: `packages/orchestrator/src/types.ts`

- [ ] **Step 1: Write failing parser tests**

Add Vitest cases proving:
- text containing `https://github.com/aryeko/pathway/pull/108` plus `already-merged DLD04 workflow` captures PR #108 but does not set `merged: true`;
- `Tracker row is done and linked to PR #108` normalizes `finalStatus: "done"`;
- a `Post-deploy smoke` line with failure/blocker language is not recorded as passed and is recorded as failed or blocker evidence;
- structured child evidence still overrides compatibility evidence.

Run: `pnpm vitest run packages/orchestrator/tests/evidence-parser.test.ts`
Expected before implementation: FAIL because the parser module does not exist or still returns old false-positive evidence.

- [ ] **Step 2: Implement the parser module**

Move `childResultEvidence`, `readEvidenceObject`, `compatibilityEvidence`, `verificationFromContent`, and local read helpers out of `CodexMcpStoryRunner.ts`. Add same-PR merge detection, tracker-row phrasing, failure-word overrides, and `blockers`/PR policy evidence capture. Keep the public API small:

```ts
export function childResultEvidence(
  structuredContent: Record<string, unknown>,
  content: string,
): ChildResultEvidence
```

- [ ] **Step 3: Wire the runner to the parser**

Import `childResultEvidence` from `./evidenceParser.js` in `CodexMcpStoryRunner.ts` and remove duplicated parser code from the runner.

- [ ] **Step 4: Verify parser green**

Run: `pnpm vitest run packages/orchestrator/tests/evidence-parser.test.ts`
Expected: PASS.

## Task 2: Completion Authority Uses Child Tracker And PR Policy

**Files:**
- Modify: `packages/orchestrator/src/runner/CompletionGate.ts`
- Modify: `packages/orchestrator/tests/completion-gate.test.ts`
- Modify: `packages/orchestrator/src/types.ts`

- [ ] **Step 1: Write failing completion tests**

Add Vitest cases proving:
- when the parent tracker snapshot says `implementing`, child worktree tracker says `done`, and PR auto-merge is enabled but merge/base evidence is incomplete, completion returns `complete: false`, source `child-worktree-tracker`, authority `pr-policy-incomplete`, and a PR-policy-specific reason;
- when child worktree tracker says `done` and git evidence proves a committed story branch under non-auto-merge policy, completion can complete using source `child-worktree-tracker`;
- existing refreshed base tracker behavior still wins when merge commit evidence is reachable from base.

Run: `pnpm vitest run packages/orchestrator/tests/completion-gate.test.ts`
Expected before implementation: FAIL because `child-worktree-tracker` and `pr-policy-incomplete` do not exist.

- [ ] **Step 2: Implement child worktree tracker reading**

Use `settled.invocation.cwd` or configured child cwd to read `trackerPath` from the child worktree filesystem, parse with `parseTrackerStories`, and consider it only when it contains the settled story in a complete status. Return authority source `child-worktree-tracker`.

- [ ] **Step 3: Implement PR policy incomplete authority**

When `pr.merge.auto` is true and a complete child/base tracker story lacks accepted auto-merge evidence, return `complete: false` with authority `pr-policy-incomplete` and reason `pr-policy-incomplete: auto-merge enabled but merged base evidence is incomplete`.

- [ ] **Step 4: Verify completion green**

Run: `pnpm vitest run packages/orchestrator/tests/completion-gate.test.ts`
Expected: PASS.

## Task 3: Analyzer Issues And Concise MCP Analysis

**Files:**
- Modify: `packages/orchestrator/src/analysis/runAnalyzer.ts`
- Modify: `packages/orchestrator/src/mcp/tools.ts`
- Modify: `packages/orchestrator/tests/analysis.test.ts`
- Modify: `packages/orchestrator/tests/mcp-server.test.ts`

- [ ] **Step 1: Write failing analyzer and MCP tests**

Add Vitest cases proving:
- a DLD05-shaped run with parent `implementing`, child evidence `finalStatus: done`, PR #108, no merge commit, and failed post-deploy smoke produces non-empty issues for stale parent snapshot, PR policy incomplete, and verification contradiction;
- `completionAuthority: pr-policy-incomplete` is surfaced as an actionable issue;
- default MCP `analyze_run` response omits or bounds heavy `timeline`, command-count, and token detail while `responseFormat: "detailed"` keeps the existing detailed shape.

Run: `pnpm vitest run packages/orchestrator/tests/analysis.test.ts packages/orchestrator/tests/mcp-server.test.ts`
Expected before implementation: FAIL for missing issue categories and/or oversized default response shape.

- [ ] **Step 2: Implement issue classifier**

Add deterministic issue messages from child artifacts and completion events:
- `child_tracker_parent_snapshot_mismatch`
- `pr_policy_incomplete`
- `verification_evidence_contradiction`
- `merge_evidence_false_positive_guard`
- `external_recovery_available`

Do not add any git-author metadata issue and do not treat recovered Pathway deploy smoke as a workflow-kit product blocker.

- [ ] **Step 3: Implement concise MCP analysis shaping**

For `analyze_run` only, default `responseFormat` to concise and return summary-focused structured content with bounded children/issues/review/verification/merge. Keep detailed behavior available through `responseFormat: "detailed"`.

- [ ] **Step 4: Verify analyzer green**

Run: `pnpm vitest run packages/orchestrator/tests/analysis.test.ts packages/orchestrator/tests/mcp-server.test.ts`
Expected: PASS.

## Task 4: Skill Guidance, Changeset, And Cleanup

**Files:**
- Modify: `skills/workflow-autopilot/SKILL.md`
- Modify: `plugins/agentic-workflow-kit/skills/workflow-autopilot/SKILL.md`
- Add: `.changeset/<slug>.md`
- Delete: `docs/superpowers/specs/2026-06-13-autopilot-completion-evidence-hardening-design.md`
- Delete: `docs/superpowers/plans/2026-06-13-autopilot-completion-evidence-hardening.md`

- [ ] **Step 1: Write or update tests if skill fixture sync is tested**

Run: `pnpm vitest run test/skill-authoring.test.ts`
Expected before docs sync if fixture drifts: FAIL or PASS depending on current fixture checks.

- [ ] **Step 2: Update workflow-autopilot guidance**

Add durable guidance for sparse supervision updates, MCP-first watch/analyze before branch or app changes, and checking CI/deploy evidence before app-code edits. Keep it concise and copy the same content into the materialized plugin fixture.

- [ ] **Step 3: Add changeset**

Create a patch changeset:

```md
---
"@agentic-workflow-kit/orchestrator": patch
---

Harden autopilot completion evidence parsing, PR-policy blocking, and run analysis diagnostics.
```

- [ ] **Step 4: Remove transient docs before PR**

Delete the spec and this plan from `docs/superpowers/` in the final implementation commit. The durable design record is the tests, skill guidance, and changeset.

- [ ] **Step 5: Verify full repo gate**

Run: `pnpm check`
Expected: PASS.

- [ ] **Step 6: Review and PR**

Spawn a review agent with the spec requirements, base/head SHAs, and changed files. Fix critical/important issues, rerun targeted tests and `pnpm check`, then push and open a non-draft PR with a conventional title.
