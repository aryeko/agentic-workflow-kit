---
title: AWK081 implementation plan
owner: codex-2026-06-13T23-29-42Z
last-reviewed: 2026-06-14
related:
  - ../specs/2026-06-14-awk081-awk08-1-review-continuity-policy-design.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK081.md
  - ../../tracks/agentic-workflow-kit-redesign/README.md
---

# AWK081 implementation plan

## Scope

Preserve local pre-PR review continuity evidence in analyzer output. The repo already documents the
policy in config/docs/skill surfaces; this plan implements the remaining machine-readable analyzer
contract and tests.

## Steps

1. Add failing analyzer coverage.
   - In `test/run-analyzer.test.ts`, add or update a fixture whose events contain multiple
     `pre_pr_review_*` loops with `agentId`, `previousAgentId`, and `continuityMode`.
   - Expected loop entries must include the new nullable fields.
   - Cover at least `reused-agent` and `new-agent-incremental-context`; include `full-context` if it
     keeps the fixture clearer.

2. Update analyzer types and event extraction.
   - In `packages/orchestrator/src/analysis/runAnalyzer.ts`, extend `PrePrReviewLoop` with
     `agentId`, `previousAgentId`, and `continuityMode`.
   - Add a small helper that reads continuity fields from normalized events.
   - Use that helper for findings and pass loops.
   - Keep fallback loop numbering unchanged.
   - Keep legacy events valid by returning `null` for missing continuity fields.

3. Update session-log review loop shape.
   - In `packages/orchestrator/src/metrics/sessionLogMetrics.ts`, extend `SessionReviewLoop` with
     nullable `previousAgentId` and `continuityMode`.
   - Session transcript heuristics should not infer continuity mode.
   - Add/update `test/session-log-metrics.test.ts` coverage for a review subagent wait result.

4. Run focused verification.
   - `pnpm vitest run test/run-analyzer.test.ts test/session-log-metrics.test.ts`
   - Fix failures without expanding scope.

5. Run full configured verification.
   - `pnpm check`
   - Record rendered verification as not applicable because this story has no UI surface.

6. Pre-PR review and closeout.
   - Run the configured read-only subagent pre-PR review if explicitly authorized by the host/user.
   - If the host policy blocks subagent spawning, record `pre_pr_review_blocked` and stop before PR
     creation with the configured actionable wording.
   - If review passes, re-read the tracker, mark AWK081 `done`, commit, create the PR, wait for CI
     and Codex bot review, update the PR column, and auto-merge only when all configured gates are
     satisfied.

## Verification

Focused:

```bash
pnpm vitest run test/run-analyzer.test.ts test/session-log-metrics.test.ts
```

Full:

```bash
pnpm check
```
