---
title: AWK081 detailed technical story spec
owner: codex-2026-06-13T23-29-42Z
last-reviewed: 2026-06-14
related:
  - ../../tracks/agentic-workflow-kit-redesign/README.md
  - ../../tracks/agentic-workflow-kit-redesign/stories/AWK081.md
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution/04-ai-observability-operations.md
---

# AWK081 detailed technical story spec

## Source story brief

`docs/tracks/agentic-workflow-kit-redesign/stories/AWK081.md`

## Decisions resolved from the story brief

| Question | Decision | Rationale |
| --- | --- | --- |
| Which host tools can continue a completed review subagent thread, and how should the runtime detect that capability? | Treat same-reviewer continuation as an opportunistic host capability outside config. Runtime and interactive instructions should prefer continuing the same review subagent/thread when the host exposes a continuation tool for the previous `agentId`. If no such tool is available or continuation fails, spawn a new read-only review subagent with the incremental packet and record `continuityMode: "new-agent-incremental-context"`. | This matches the technical solution without adding a brittle host-specific config key. The durable artifact explains whether context continuity was reused, intentionally full-context, or fell back to a new reviewer. |
| Should `continuityMode` be required on every follow-up review event or only when `loop > 1`? | `continuityMode` is optional on loop 1 and should be recorded on every loop greater than 1. Analyzer output should preserve any recorded value and default missing follow-up values to `null` for legacy journals. | Loop 1 has no prior reviewer to continue. Keeping the field nullable preserves compatibility with old artifacts while making new follow-up loops machine-readable. |
| Does analyzer/report behavior belong in this story or should AWK10 own all interpretation? | This story adds analyzer extraction and tests for local pre-PR review continuity fields. AWK10 can later improve report rendering over the same data. | AWK09/AWK10 depend on AWK081, and OBS-3/OBS-5 require inspectable machine-readable review-loop evidence before downstream status/report surfaces consume it. |

## Exact types/contracts

`packages/orchestrator/src/analysis/runAnalyzer.ts`

- Extend `PrePrReviewLoop` with:

```ts
interface PrePrReviewLoop {
  loop: number | null;
  mode: string | null;
  status: string;
  findings: number | null;
  agentId: string | null;
  previousAgentId: string | null;
  continuityMode: 'reused-agent' | 'new-agent-incremental-context' | 'full-context' | string | null;
}
```

- Local pre-PR review events that can produce loop summaries:
  - `pre_pr_review_completed` with `verdict: "PASS"` or `verdict: "BLOCK"`.
  - `pre_pr_review_findings`.
  - Legacy `pre_pr_review_blocked` with a findings payload.
  - Legacy `pre_pr_review_passed` / `pre_pr_review_cleared`.
- For every event-derived loop, copy `agentId`, `previousAgentId`, and `continuityMode` when present.
- Keep `review.prePr.subagent.agentId` as the latest known reviewer agent id, preferring explicit event data over session-log reconstruction.
- Session-log-derived review loops continue to expose `agentId`; `previousAgentId` and `continuityMode` are `null` unless future transcript parsing can prove them.

`packages/orchestrator/src/metrics/sessionLogMetrics.ts`

- Extend `SessionReviewLoop` with nullable `previousAgentId` and `continuityMode`.
- Session log parsing remains heuristic. It should not infer same-thread reuse from two waits against one target unless the host call/result explicitly records continuation semantics.

Run artifact event convention:

```json
{
  "type": "pre_pr_review_completed",
  "loop": 2,
  "mode": "subagent",
  "agentId": "reviewer-2",
  "previousAgentId": "reviewer-1",
  "continuityMode": "new-agent-incremental-context",
  "verdict": "PASS",
  "findings": []
}
```

## Exact files/modules

```text
packages/orchestrator/src/analysis/runAnalyzer.ts  Preserve pre-PR review continuity fields in analyzer loop summaries and child/session-derived review evidence.
packages/orchestrator/src/metrics/sessionLogMetrics.ts  Extend session-derived loop shape with nullable continuity fields.
test/run-analyzer.test.ts  Add focused fixture coverage for reused reviewer, new-agent incremental fallback, and full-context loop events.
test/session-log-metrics.test.ts  Add focused coverage that session-derived review loops keep nullable continuity fields.
docs/tracks/agentic-workflow-kit-redesign/README.md  Update AWK081 spec/plan/status/PR cells as the workflow progresses.
```

## Query/schema/prompt/event/component design

No database queries, UI components, routes, or migrations are in scope.

Prompt/instruction behavior is already documented in `skills/implement-next/SKILL.md` and
`references/config-schema.md`: follow-up local pre-PR review loops prefer the same review
subagent/thread, and a new read-only subagent with incremental context is an expected host fallback,
not a downgrade. This story makes analyzer output retain that evidence instead of flattening it
away.

Analyzer event behavior:

- `pre_pr_review_started` records requested/actual mode but does not create a loop entry.
- Finding events create loop entries with `status: "findings"` and `findings` equal to the count of
  the findings payload.
- Passing events create loop entries with `status: "passed"` and `findings: 0`.
- `loop` continues to use the event value when present and existing fallback numbering when absent.
- `continuityMode` accepts the documented strings but remains string-compatible for future host
  modes.
- Missing continuity fields remain `null`, not inferred.

## Tests

- `pnpm vitest run test/run-analyzer.test.ts test/session-log-metrics.test.ts`
  - Analyzer fixture with three local pre-PR review loops:
    - loop 1 full subagent findings with `agentId`.
    - loop 2 findings using `previousAgentId` plus `continuityMode: "reused-agent"`.
    - loop 3 pass using `previousAgentId` plus `continuityMode: "new-agent-incremental-context"`.
  - Existing analyzer loop tests update expected loop objects with the new nullable fields.
  - Session-log metrics test verifies derived review loops include `agentId` and nullable continuity
    fields.
- `pnpm check`

Rendered/browser verification is not applicable because AWK081 has no UI surface. The repo test
gates above are the verification surface.

## Migration/deploy concerns

No data migration or hosted deployment is required. The analyzer change is additive in JSON output:
existing journals without continuity fields still analyze, and consumers that ignore the new loop
fields continue to work. Existing event names and status semantics remain unchanged.

## Blocking technical questions

None
