# Implement-Next Review and Analyzer Hardening Design

## Context

The Pathway PLD04 implement-next run completed and merged, but it exposed gaps in the interactive
workflow contract and the `analyze-run` audit output. The run downgraded configured auto subagent
review to inline review because Codex required explicit user authorization for delegation. A later
manual review subagent passed, but Codex PR review still found a valid P2 product semantics bug. The
run journal also made review, verification, and merge ordering hard to audit after the fact.

This change hardens the generic `agentic-workflow-kit` behavior without adding a new automation
surface. The interactive skill remains instruction-driven, and the TypeScript analyzer reconstructs
more process evidence from existing journals.

## Goals

- Define exact `implement.review.prePr.mode` semantics for `inline`, `auto`, and `subagent`.
- Make strict subagent mode fail closed before PR creation when explicit delegation or tooling is
  unavailable.
- Preserve auto-mode downgrade behavior, but make it visible as a warning in the journal, analyzer,
  and docs.
- Make review loops explicitly bounded and incremental by default, separate from external PR review.
- Improve the pre-PR review checklist so reviewers check spec, product, UI, label, unit, route, and
  locale semantics in addition to code shape.
- Extend `analyze-run` so PLD04-style interactive journals remain useful when session metadata is
  missing.
- Make event chronology deterministic by documenting and supporting `recordedAt` and `eventAt` while
  preserving legacy `ts` journals.
- Detect merge-before-final-verification after PR review fixes.
- Keep schema, generated schema, plugin fixture, bundled MCP runtime, and tests in sync.

## Non-goals

- Implement a real subagent launcher inside the skill. Codex/Claude delegation remains host-policy
  controlled.
- Change `pr.review.rerequestAfterFix` default or force repeated external PR review.
- Infer tool or token metrics when no session log exists.
- Change tracker state semantics.

## Behavior Contract

### Pre-PR review modes

- `inline`: always review in the current session. No downgrade event is needed.
- `auto`: attempt subagent review only when `implement.subagents.enabled` is true and host policy
  already allows explicit delegation. If delegation cannot run, perform inline review and append
  `pre_pr_review_downgraded` with requested mode, actual mode, and reason.
- `subagent`: require a real spawned review agent. If explicit delegation is missing, a review tool
  is unavailable, or the review cannot run, append `pre_pr_review_blocked`, set the run blocked, and
  stop before PR creation. The blocked message must include:
  `You are explicitly authorized to delegate the pre-PR review to a read-only review subagent if configured.`
- `pre_pr_review_cleared` may record `actualMode: "subagent"` only when a spawned review agent
  returns a result. A manual inline review cannot be recorded as subagent success.

### Review loops

- Local pre-PR review loops are bounded by `implement.review.prePr.maxLoops`.
- `loopMode: incremental` means loop 1 gets the full packet; later loops get prior findings, fix
  summary, changed diff since the previous loop, and latest verification evidence.
- `loopMode: full` means every loop gets the full packet.
- External PR review fix behavior is controlled only by `pr.review.rerequestAfterFix`.
- When `pr.review.rerequestAfterFix: false`, one external review pass plus local fix verification
  and comment resolution is enough.

### Review checklist

The pre-PR review packet must ask the reviewer to verify:

- acceptance criteria against actual behavior,
- product semantics and visible UI states,
- label/value consistency,
- percent vs count/unit formatting,
- route intent correctness,
- dashboard state semantics,
- locale-backed Hebrew copy meaning when applicable,
- architecture boundaries and repo instructions,
- tests covering the risky behavior.

### Journal chronology

Future events should include:

- `recordedAt`: when the event was written,
- `eventAt`: when the underlying action happened, defaulting to `recordedAt` for immediate events,
- `type`: event name.

Legacy events with only `ts` remain valid. The analyzer sorts by `eventAt`, then `recordedAt`, then
append index.

### Analyzer output

`analyze-run` should add an event-derived summary while preserving existing child/session metrics.
The summary must work even when `interactive.sessionId` and `sessionLogPath` are null.

New output shape:

```ts
interface WorkflowRunAnalysis {
  review: {
    prePr: {
      requestedMode: string | null;
      actualMode: string | null;
      status: 'not_configured' | 'not_started' | 'downgraded' | 'blocked' | 'passed' | 'findings';
      warnings: string[];
      blockers: string[];
      maxLoops: number | null;
      loopMode: string | null;
      loops: Array<{ loop: number | null; mode: string | null; status: string; findings: number | null }>;
      subagent: { agentId: string | null; status: string | null };
    };
    pr: {
      findings: Array<{ severity: string | null; summary: string; file: string | null }>;
      fixBatchCount: number;
      rerequestAfterFix: boolean | null;
    };
  };
  verification: {
    commands: Array<{ phase: string | null; command: string | null; status: string; eventAt: string | null }>;
    finalPassedAt: string | null;
  };
  merge: {
    merged: boolean;
    mergedAt: string | null;
    cleanupStatus: string | null;
    mergeBeforeFinalVerification: boolean;
  };
  timeline: Array<{ type: string; eventAt: string | null; recordedAt: string | null; index: number }>;
}
```

The analyzer should add issues for:

- auto pre-PR downgrade,
- strict pre-PR subagent blocker,
- merge after review fixes without final verification,
- merge before final verification.

## Files

- `skills/implement-next/SKILL.md`: interactive contract and review prompt updates.
- `references/config-schema.md`: human schema details for mode, loop, and review separation.
- `packages/orchestrator/src/analysis/runAnalyzer.ts`: event parsing, summary derivation, timeline
  sorting, and issue detection.
- `packages/orchestrator/tests/analysis.test.ts` and `test/run-analyzer.test.ts`: red tests for
  PLD04-style interactive journals and ordering blockers.
- `test/skill-authoring.test.ts` and `test/config-doc-sync.test.ts`: docs contract tests.
- `references/config.schema.json`, `plugins/agentic-workflow-kit/**`, `mcp/server.mjs`: generated
  and materialized fixtures after source changes.

## Verification

- Focused red/green:
  - `pnpm --filter @agentic-workflow-kit/orchestrator test -- analysis`
  - `pnpm vitest run test/run-analyzer.test.ts test/skill-authoring.test.ts test/config-doc-sync.test.ts`
- Regeneration:
  - `pnpm generate-schema`
  - `pnpm build:plugin-mcp`
- Final gate:
  - `pnpm check`

## Blocking technical questions

None.
