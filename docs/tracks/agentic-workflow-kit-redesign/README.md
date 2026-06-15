---
title: agentic-workflow-kit redesign tracker
status: approved
owner: "—"
last-reviewed: 2026-06-13
related:
  - ../../prds/agentic-workflow-kit-redesign/README.md
  - ../../prds/agentic-workflow-kit-redesign/technical-solution.md
  - ../../../AGENTS.md
  - ../../architecture.md
---

# agentic-workflow-kit redesign tracker

*This track delivers the V1 redesign described in the PRD and technical solution: independent
workflow authoring, contract-backed trackers and migration, profile/budget-aware autonomous
runtime, product-first CLI/MCP APIs, observability/control/reporting, GitHub collaboration
evidence, docs consolidation, and release readiness. The PRD owns what/why; the technical solution
owns high-level how; this doc owns sequencing and parallelism. Each story (AWKn) has a lightweight
brief; the detailed story spec and implementation plan are created by implement-next.*

## Context

This track decomposes the `agentic-workflow-kit-redesign` PRD into implementation stories that can
be run by the currently installed, pinned WorkflowKit plugin version 0.5.13. Code changes made by
the stories are not assumed to affect the orchestrator executing the track until the final release.

The repo audit found a package-backed MCP/CLI runtime under `packages/orchestrator/`, shared plugin
skills under `skills/`, durable contracts under `references/`, presets, examples, Codex/Claude
plugin metadata, and tests covering schemas, trackers, manifests, package smoke, analyzer, and the
orchestrator. Repo policy requires story specs/plans to live transiently under `docs/superpowers/`
and canonical docs to be updated before release.

This tracker covers story order, dependencies, and safe parallelism. Per-story delivery context
lives in each story brief; detailed technical story specs and implementation plans come later.

After AWK13, a deep [release-readiness review](./release-readiness-review.md) found that the track is
not yet ready to ship. The remediation is sequenced as stories **AWK13.1–AWK13.7** (see the
[release-hardening design](../../prds/agentic-workflow-kit-redesign/release-hardening-design.md)),
inserted between AWK13 and AWK14; they **block AWK14**, which remains the final release-readiness
story.

After AWK13.1–AWK13.7 landed, a second [release-readiness review (round 2)](./release-readiness-review-2.md)
confirmed all round-1 blockers are genuinely fixed but surfaced a bounded set of remaining gaps. The
round-2 remediation is sequenced as stories **AWK13.8–AWK13.12** (see the
[release-hardening design 2](../../prds/agentic-workflow-kit-redesign/release-hardening-design-2.md)),
inserted between AWK13.7 and AWK14; they **also block AWK14**.

## Dependency graph

```mermaid
flowchart TD
  AWK01[AWK01 API facade foundation]
  AWK02[AWK02 Agent profiles and budgets]
  AWK03[AWK03 Tracker validation and migration]
  AWK04[AWK04 Workflow authoring independence]
  AWK05[AWK05 Driver contract and Codex profile launch]
  AWK06[AWK06 Runtime event and artifact model]
  AWK07[AWK07 Run control and abort]
  AWK08[AWK08 Story and track autopilot policy]
  AWK081[AWK08.1 Review continuity policy]
  AWK09[AWK09 Status and streaming API]
  AWK10[AWK10 Analyzer and report bundle]
  AWK11[AWK11 GitHub evidence hardening]
  AWK12[AWK12 Plugin package compatibility]
  AWK13[AWK13 Canonical docs consolidation]
  AWK131[AWK13.1 Provider-neutral driver boundary]
  AWK132[AWK13.2 GitHub verification and recovery]
  AWK133[AWK13.3 Run-state durability and concurrency]
  AWK134[AWK13.4 Conservative defaults and API fidelity]
  AWK135[AWK13.5 Module decomposition]
  AWK136[AWK13.6 Test trust and coverage ratchet]
  AWK137[AWK13.7 Stale docs and DevX hygiene]
  AWK138[AWK13.8 Provider-neutral wiring]
  AWK139[AWK13.9 Run-state write atomicity]
  AWK1310[AWK13.10 API error fidelity]
  AWK1311[AWK13.11 Test trust round 2]
  AWK1312[AWK13.12 DevX/docs hygiene round 2]
  AWK14[AWK14 Changeset and release readiness]

  AWK01 --> AWK02
  AWK01 --> AWK03
  AWK01 --> AWK04
  AWK02 --> AWK05
  AWK02 --> AWK06
  AWK03 --> AWK08
  AWK05 --> AWK08
  AWK06 --> AWK07
  AWK06 --> AWK08
  AWK06 --> AWK09
  AWK06 --> AWK10
  AWK07 --> AWK09
  AWK08 --> AWK081
  AWK081 --> AWK09
  AWK081 --> AWK10
  AWK08 --> AWK11
  AWK09 --> AWK10
  AWK09 --> AWK12
  AWK10 --> AWK12
  AWK11 --> AWK12
  AWK12 --> AWK13
  AWK13 --> AWK131
  AWK131 --> AWK132
  AWK131 --> AWK134
  AWK132 --> AWK133
  AWK132 --> AWK135
  AWK133 --> AWK135
  AWK134 --> AWK135
  AWK135 --> AWK136
  AWK135 --> AWK137
  AWK136 --> AWK138
  AWK137 --> AWK138
  AWK138 --> AWK139
  AWK138 --> AWK1310
  AWK138 --> AWK1312
  AWK139 --> AWK1311
  AWK1310 --> AWK1311
  AWK1311 --> AWK14
  AWK1312 --> AWK14
```

**Reading the graph:** every solid arrow is a hard dependency. The source story must be in a
`statuses.complete` state before the target starts. Nodes with no inbound edge can start
immediately.

## Status matrix

Statuses come from `references/tracker-contract.md`:
`specced` → `plan-approved` → `implementing` → `done` → `verified`, plus terminal
`blocked` / `canceled` / `deferred` / `superseded`. IDs match `tracker.idPattern`.

| ID | Name | Depends on | Wave | Status | Spec | Plan | Owner | PR |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AWK01 | API facade foundation | — | W1 | done | [brief](./stories/AWK01.md) | — | codex | [#56](https://github.com/aryeko/agentic-workflow-kit/pull/56) |
| AWK02 | Agent profiles and budgets | AWK01 | W2 | done | [brief](./stories/AWK02.md) | — | codex | [#58](https://github.com/aryeko/agentic-workflow-kit/pull/58) |
| AWK03 | Tracker validation and migration | AWK01 | W2 | done | [brief](./stories/AWK03.md) | — | codex | [#57](https://github.com/aryeko/agentic-workflow-kit/pull/57) |
| AWK04 | Workflow authoring independence | AWK01 | W2 | done | [brief](./stories/AWK04.md) | — | codex | [#59](https://github.com/aryeko/agentic-workflow-kit/pull/59) |
| AWK05 | Driver contract and Codex profile launch | AWK02 | W3 | done | [brief](./stories/AWK05.md) | — | codex | [#61](https://github.com/aryeko/agentic-workflow-kit/pull/61) |
| AWK06 | Runtime event and artifact model | AWK02 | W3 | done | [brief](./stories/AWK06.md) + [contract](../../../references/runtime-artifact-contract.md) | — | codex | [#60](https://github.com/aryeko/agentic-workflow-kit/pull/60) |
| AWK07 | Run control and abort | AWK06 | W4 | done | [brief](./stories/AWK07.md) | — | codex | [#63](https://github.com/aryeko/agentic-workflow-kit/pull/63) |
| AWK08 | Story and track autopilot policy | AWK03, AWK05, AWK06 | W4 | done | [brief](./stories/AWK08.md) | — | codex-2026-06-13T22-51-49Z | [#62](https://github.com/aryeko/agentic-workflow-kit/pull/62) |
| AWK081 | AWK08.1 Review continuity policy | AWK08 | W4.5 | done | [brief](./stories/AWK081.md) | — | codex-2026-06-13T23-29-42Z | [#65](https://github.com/aryeko/agentic-workflow-kit/pull/65) |
| AWK09 | Status and streaming API | AWK06, AWK07, AWK081 | W5 | done | [brief](./stories/AWK09.md) | — | codex-2026-06-13T23-54-50Z | [#67](https://github.com/aryeko/agentic-workflow-kit/pull/67) |
| AWK10 | Analyzer and report bundle | AWK06, AWK09, AWK081 | W5 | done | [brief](./stories/AWK10.md) | — | codex-2026-06-14T01-45-49Z | [#68](https://github.com/aryeko/agentic-workflow-kit/pull/68) |
| AWK11 | GitHub evidence hardening | AWK08 | W5 | done | [brief](./stories/AWK11.md) | — | codex-2026-06-13T23-54-50Z | [#66](https://github.com/aryeko/agentic-workflow-kit/pull/66) |
| AWK12 | Plugin package compatibility | AWK09, AWK10, AWK11 | W6 | done | [brief](./stories/AWK12.md) | — | codex-2026-06-14T02-16-42Z | [#69](https://github.com/aryeko/agentic-workflow-kit/pull/69) |
| AWK13 | Canonical docs consolidation | AWK12 | W7 | done | [brief](./stories/AWK13.md) | — | codex-2026-06-14T02-55-42Z | [#70](https://github.com/aryeko/agentic-workflow-kit/pull/70) |
| AWK131 | AWK13.1 Provider-neutral driver boundary | AWK13 | W7.1 | done | [brief](./stories/AWK131.md) | — | codex-2026-06-14T05-01-48Z | [#72](https://github.com/aryeko/agentic-workflow-kit/pull/72) |
| AWK132 | AWK13.2 GitHub verification and recovery | AWK131 | W7.2 | done | [brief](./stories/AWK132.md) | — | codex | [#74](https://github.com/aryeko/agentic-workflow-kit/pull/74) |
| AWK133 | AWK13.3 Run-state durability and concurrency | AWK132 | W7.3 | done | [brief](./stories/AWK133.md) | — | codex-2026-06-14T10-04-18Z | [#77](https://github.com/aryeko/agentic-workflow-kit/pull/77) |
| AWK134 | AWK13.4 Conservative defaults and API fidelity | AWK131 | W7.2 | done | [brief](./stories/AWK134.md) | — | codex-2026-06-14T09-55-09Z | [#76](https://github.com/aryeko/agentic-workflow-kit/pull/76) |
| AWK135 | AWK13.5 Module decomposition | AWK132, AWK133, AWK134 | W7.4 | done | [brief](./stories/AWK135.md) | — | codex-2026-06-15T09-38-02Z | [#78](https://github.com/aryeko/agentic-workflow-kit/pull/78) |
| AWK136 | AWK13.6 Test trust and coverage ratchet | AWK135 | W7.5 | done | [brief](./stories/AWK136.md) | — | codex-2026-06-15T16-51-16Z | [#79](https://github.com/aryeko/agentic-workflow-kit/pull/79) |
| AWK137 | AWK13.7 Stale docs and DevX hygiene | AWK135 | W7.5 | done | [brief](./stories/AWK137.md) | — | codex-2026-06-15T17-04-23Z | [#80](https://github.com/aryeko/agentic-workflow-kit/pull/80) |
| AWK138 | AWK13.8 Provider-neutral wiring | AWK136, AWK137 | W7.6 | specced | [brief](./stories/AWK138.md) | — | — | — |
| AWK139 | AWK13.9 Run-state write atomicity | AWK138 | W7.7 | specced | [brief](./stories/AWK139.md) | — | — | — |
| AWK1310 | AWK13.10 API error fidelity | AWK138 | W7.7 | specced | [brief](./stories/AWK1310.md) | — | — | — |
| AWK1311 | AWK13.11 Test trust round 2 | AWK139, AWK1310 | W7.8 | specced | [brief](./stories/AWK1311.md) | — | — | — |
| AWK1312 | AWK13.12 DevX/docs hygiene round 2 | AWK138 | W7.8 | specced | [brief](./stories/AWK1312.md) | — | — | — |
| AWK14 | Changeset and release readiness | AWK1311, AWK1312 | W8 | deferred | [brief](./stories/AWK14.md) | — | — | — |

Keep the **Status** column current. Leave **Plan** as `—` — the implementing session drafts the
plan after creating the detailed technical story spec. Each story maps to one or more PRD
acceptance-criteria IDs in its story brief.

## Parallelism rules

**Wave 1 — Foundation (sequential):** AWK01 runs alone. It defines the shared API/result envelope
that later CLI/MCP/config/runtime stories must align to.

**Wave 2 — Contract and authoring split (up to 2-way parallel):** AWK02, AWK03, and AWK04 may run
with at most two concurrent sessions because they touch different primary surfaces but may contend
on references, presets, and docs tests.

**Wave 3 — Driver and artifact foundations (up to 2-way parallel):** AWK05 and AWK06 can run
concurrently only if detailed specs keep driver-contract files and artifact/event files disjoint.

**Wave 4 — Runtime behavior (mostly sequential):** AWK07 and AWK08 both touch `WorkflowRunner`,
handlers, and state transitions. Run AWK07 first when possible, then AWK08.

**Wave 4.5 — Review policy follow-up (sequential):** AWK081 is an AWK08 follow-up for local
pre-PR review continuity semantics. Run it after AWK08 lands and before AWK09/AWK10 consume
review-loop events in status, stream, analyzer, or report surfaces.

**Wave 5 — Observability and collaboration (up to 2-way parallel):** AWK09, AWK10, and AWK11 may
run with at most two concurrent sessions after runtime state is stable. They have likely contention
in analyzer/event fixtures, so coordinate before editing shared fixtures.

**Wave 6 — Package/plugin compatibility (sequential):** AWK12 touches plugin metadata, package
smoke tests, and examples. Run alone after implementation-facing behavior settles.

**Wave 7 — Docs consolidation (sequential):** AWK13 runs after all implementation stories. It
audits every repo `*.md` surface, including root READMEs, `AGENTS.md`, `CONTRIBUTING.md`, package
and plugin Markdown, and folds durable content from transient `docs/superpowers/` specs/plans into
canonical docs. Launch AWK13 with extra-high, or the highest supported, reasoning effort. It must
write and verify replacement docs before removing or archiving old docs or transient specs/plans.
AWK13 is intentionally `deferred` so autopilot does not launch it; run it manually in a new session
after AWK12 is complete by changing its status back to `specced`/`plan-approved` or by force-running
that story.

**Waves 7.1–7.5 — Release hardening (mostly sequential):** AWK13.1–AWK13.7 remediate the gaps found
in the [release-readiness review](./release-readiness-review.md); the fix design is in
[release-hardening-design](../../prds/agentic-workflow-kit-redesign/release-hardening-design.md).
These stories are `specced` (eligible), not `deferred` — they are the next real implementation work.
W7.1: AWK13.1 (neutral driver boundary) lands first because later fixes ride its seams. W7.2: AWK13.2
(GitHub verification) and AWK13.4 (safety defaults + API fidelity) both depend only on AWK13.1 and
may run up to 2-way parallel, but both touch `WorkflowRunner`/handlers, so coordinate. W7.3: AWK13.3
(run-state durability) follows AWK13.2 on the settled runner shape. W7.4: AWK13.5 (module
decomposition) lands after the behavioral fixes so it reshapes their final form — run it alone.
W7.5: AWK13.6 (test trust) and AWK13.7 (docs/DevX hygiene) depend on AWK13.5 and may run 2-way
parallel; both gate AWK14.

**Waves 7.6–7.8 — Release hardening round 2 (mostly sequential):** AWK13.8–AWK13.12 remediate the
gaps found in the [round-2 release-readiness review](./release-readiness-review-2.md); the fix design
is in [release-hardening-design-2](../../prds/agentic-workflow-kit-redesign/release-hardening-design-2.md).
These stories are `specced` (eligible), not `deferred` — they are the next real implementation work
and block AWK14. W7.6: AWK13.8 (provider-neutral wiring) lands first because the later fixes ride its
seams (control routing, driver factory, artifact-dir derivation). W7.7: AWK13.9 (run-state
atomicity) and AWK13.10 (API error fidelity) depend only on AWK13.8 and may run up to 2-way parallel
on disjoint surfaces (artifacts/runner vs `api/facade`); coordinate only if both touch
`commands/handlers.ts`. W7.8: AWK13.11 (test trust) depends on AWK13.9 and AWK13.10 so coverage
reflects final shapes; AWK13.12 (docs/DevX hygiene) depends only on AWK13.8. Both gate AWK14 and may
run 2-way parallel.

**Wave 8 — Release readiness (sequential):** AWK14 runs last and is blocked by AWK13.11 and AWK13.12.
It creates the consolidated changeset and release handoff after docs are canonical and both hardening
rounds land. AWK14 is intentionally `deferred` so autopilot cannot launch release-readiness work
accidentally; run it manually after AWK13.1–AWK13.12 are complete by changing its status back to
`specced`/`plan-approved` or by force-running that story.

## ID-prefix registry

This track reserves the prefix **`AWK`**. It is recorded in `docs/tracks/README.md` and is never
reused by another track.

## How to pick up a story

1. Confirm the executing WorkflowKit plugin remains pinned to installed version 0.5.13.
2. Find a row whose **Depends on** are all in a `statuses.complete` state and whose **Status** is
   in `statuses.eligible`.
3. Claim it (set **Owner**; isolate per `git.strategy`) and flip **Status** to
   `statuses.inProgress`.
4. Read the linked story brief.
5. Create/refine the detailed technical story spec under `docs/superpowers/specs`.
6. If no plan exists, draft one under `docs/superpowers/plans`.
7. Execute. Before opening the PR, flip **Status** to `done` in this table in the same change.
8. Fill the **PR** column once the PR exists.

## Ground rules

- **Pinned executor:** all stories are executed by the installed 0.5.13 WorkflowKit plugin/runtime.
  Do not depend on code changes from this track to run later stories until AWK14 completes release
  readiness.
- **One story per PR.** Do not bundle.
- **No per-story changesets by default.** AWK14 owns the consolidated changeset and release
  readiness. Add an earlier changeset only if a detailed story spec proves the release tooling
  requires it.
- **Transient specs/plans:** implementation stories may create `docs/superpowers/` specs/plans.
  AWK13 is the final canonical-docs sweep that consumes any remaining durable content before
  release.
- **The tracker is the single source of truth for status** — never infer completion from child
  session prose.
- **When the story brief is wrong, update it in the same PR** as the detailed spec or code that
  surfaced the gap.

## Related

- [PRD](../../prds/agentic-workflow-kit-redesign/README.md)
- [Technical solution](../../prds/agentic-workflow-kit-redesign/technical-solution.md)
- [Release-readiness review](./release-readiness-review.md)
- [Release-readiness review (round 2)](./release-readiness-review-2.md)
- [Release-hardening design](../../prds/agentic-workflow-kit-redesign/release-hardening-design.md)
- [Release-hardening design 2](../../prds/agentic-workflow-kit-redesign/release-hardening-design-2.md)
- [Repo architecture](../../architecture.md)
- [Repo instructions](../../../AGENTS.md)
- `./stories/` — story briefs
