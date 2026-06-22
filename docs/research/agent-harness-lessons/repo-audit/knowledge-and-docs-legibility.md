# Knowledge and docs legibility audit

## Scope

Audit scope: `AGENTS.md`, `docs/design`, `docs/implementation`, `docs/engineering`,
`docs/research`, and docs navigation tooling.

Read-first sources: `docs/research/agent-harness-lessons/GUIDELINE-MATRIX.md` and
`docs/research/agent-harness-lessons/repo-audit/current-system-map.md`. Statuses:
`strong`, `partial`, `gap`, `not applicable`.

Files inspected included `AGENTS.md`, `docs/README.md`, relevant `docs/design/**`,
`docs/implementation/**`, `docs/engineering/**`, and `docs/research/**` surfaces,
`tooling/docs-nav/**`, `package.json`, `packages/**/README.md`, and
`packages/sdk/src/foundation/**`.

## Findings

### 1. strong - Source-of-truth structure is explicit

`AGENTS.md` names `docs/design/` as source of truth and routes work by question type:
architecture, requirements, decisions, vocabulary, domain catalog, engineering gates,
roadmap, and research context (`AGENTS.md:20`, `AGENTS.md:22`, `AGENTS.md:24`,
`AGENTS.md:35`). It also tells agents to pull only the touched corpus slice
(`AGENTS.md:39`, `AGENTS.md:41`, `AGENTS.md:54`).

The docs home and design overview repeat the guided descent: readers stop at the depth
their task requires, then go deep only into the changed domain (`docs/README.md:9`,
`docs/README.md:13`, `docs/README.md:23`, `docs/design/README.md:9`,
`docs/design/README.md:31`, `docs/design/README.md:36`). This supports the matrix's
P0 local/versioned/navigable knowledge guideline
(`docs/research/agent-harness-lessons/GUIDELINE-MATRIX.md:16`).

The ownership split is also explicit: design owns normative truth, engineering owns
verification policy, and implementation owns slicing/readiness evidence
(`docs/implementation/README.md:15`, `docs/implementation/README.md:17`,
`docs/implementation/README.md:23`; `docs/engineering/README.md:14`).

### 2. strong - Progressive disclosure is a corpus rule

The reading guide starts each session with a small orientation set and then a
task-specific path (`docs/design/00-orientation/reading-guide.md:9`,
`docs/design/00-orientation/reading-guide.md:13`,
`docs/design/00-orientation/reading-guide.md:22`). The conventions doc requires
high-to-low structure, focused files, retrievable-in-isolation domain reads, and
single-source-per-fact discipline (`docs/design/00-orientation/conventions.md:12`,
`docs/design/00-orientation/conventions.md:17`,
`docs/design/00-orientation/conventions.md:20`,
`docs/design/00-orientation/conventions.md:22`,
`docs/design/00-orientation/conventions.md:24`).

Keep this pattern. Do not grow `AGENTS.md` into a manual; the matrix already marks
the short-entry-contract lesson as strong
(`docs/research/agent-harness-lessons/GUIDELINE-MATRIX.md:17`).

### 3. partial - Freshness checks cover normative nav, not all repo knowledge

`pnpm check` starts with `docs:nav:check`, and the check gate documents docs-nav
freshness as step 1 (`package.json:40`, `package.json:42`,
`docs/engineering/check-gate.md:15`, `docs/engineering/check-gate.md:17`,
`docs/engineering/check-gate.md:27`). The local gate also has a `stale-docs-nav`
failure token (`tooling/docs-nav/local-check-gate.ts:1`,
`tooling/docs-nav/local-check-gate.ts:29`).

But nav generation intentionally excludes `research/` and `evidence/`
(`tooling/docs-nav/generate-nav.mjs:46`, `tooling/docs-nav/generate-nav.mjs:49`,
`tooling/docs-nav/generate-nav.mjs:120`). `docs/research/README.md` confirms research is
dormant provenance outside the reading flow (`docs/research/README.md:8`,
`docs/research/README.md:10`, `docs/research/README.md:13`). That is right for
normative docs, but active research reports need manual README/runbook freshness.

### 4. gap - A physical architecture map is still missing

The logical architecture is strong: layers, provider contracts, drivers, foundation,
Dependency Rule, and 16-domain map are all present
(`docs/design/10-architecture/architecture.md:13`,
`docs/design/10-architecture/architecture.md:19`,
`docs/design/10-architecture/architecture.md:64`,
`docs/design/10-architecture/architecture.md:151`). The package target names the
eight-package delivery surface (`docs/design/20-sdk-and-packaging/package-target.md:13`,
`docs/design/20-sdk-and-packaging/package-target.md:16`).

The missing artifact is a short contributor-facing physical map that answers "where do I
edit?" now that foundation code exists. A repo scan found no dedicated `ARCHITECTURE.md`
or equivalent physical code map; the guideline matrix already records this as
`gap/defer` (`docs/research/agent-harness-lessons/GUIDELINE-MATRIX.md:19`).

### 5. partial - Package-state prose has drifted

Some entry docs still describe an earlier package state. `AGENTS.md` says `packages/`
is intentionally empty until design owners fill it (`AGENTS.md:134`). `packages/README.md`
says the directory is intentionally empty, then lists the eight target packages
(`packages/README.md:3`, `packages/README.md:5`, `packages/README.md:9`).
`packages/sdk/README.md` and `packages/sdk/src/README.md` still describe future or
behavior-free SDK source (`packages/sdk/README.md:3`, `packages/sdk/README.md:25`,
`packages/sdk/src/README.md:1`, `packages/sdk/src/README.md:3`).

Live foundation exports now exist for configuration policy, storage, workspace/repository,
and credentials/secrets (`packages/sdk/src/foundation/configuration-policy/index.ts:1`,
`packages/sdk/src/foundation/storage/index.ts:1`,
`packages/sdk/src/foundation/workspace-repository/index.ts:1`,
`packages/sdk/src/foundation/credentials-secrets/index.ts:1`). The current system map
also records this drift (`docs/research/agent-harness-lessons/repo-audit/current-system-map.md:66`).

### 6. partial - Compaction-safe runbooks are examples, not a convention

Story contracts are strong for grading: they require frozen inputs, falsifiable ACs,
evidence packs, owned pathsets, forbidden dependencies, and STOP conditions
(`docs/implementation/work-item-authoring-guide.md:669`,
`docs/implementation/work-item-authoring-guide.md:689`,
`docs/implementation/work-item-authoring-guide.md:739`,
`docs/implementation/work-item-authoring-guide.md:796`,
`docs/implementation/work-item-authoring-guide.md:811`). A live story includes exact
commands, evidence pack expectations, owned globs, and STOP conditions
(`docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-02-s2-event-log.md:130`,
`docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-02-s2-event-log.md:155`,
`docs/implementation/epics/epic-1-foundation-substrate/stories/fnd-02-s2-event-log.md:165`).

That is not yet a general execution journal convention. The harness runbook is the
closest active example: it says another session should resume without chat history and
tracks progress, surprises, decisions, and outcomes
(`docs/research/agent-harness-lessons/RESEARCH-RUNBOOK.md:3`,
`docs/research/agent-harness-lessons/RESEARCH-RUNBOOK.md:6`,
`docs/research/agent-harness-lessons/RESEARCH-RUNBOOK.md:19`,
`docs/research/agent-harness-lessons/RESEARCH-RUNBOOK.md:25`,
`docs/research/agent-harness-lessons/RESEARCH-RUNBOOK.md:34`). The matrix marks this
lesson partial (`docs/research/agent-harness-lessons/GUIDELINE-MATRIX.md:18`).

### 7. strong - Research artifacts are durable and source-fit oriented

The harness report separates sources, source notes, current-state audit, guideline
matrix, lessons, and repo-audit notes (`docs/research/agent-harness-lessons/README.md:17`).
Its method extracts source guidance, audits current repo evidence, classifies guidelines,
and proposes docs/story changes without runtime changes
(`docs/research/agent-harness-lessons/README.md:27`).

The earlier LangChain leverage report is a good precedent: it uses source-level fit
analysis, opportunity scoring, no-go areas, and fixture/pattern recommendations before
optional provider-side adapters (`docs/research/langchain-leverage/README.md:32`,
`docs/research/langchain-leverage/LEVERAGE-REPORT.md:23`,
`docs/research/langchain-leverage/LEVERAGE-REPORT.md:62`,
`docs/research/langchain-leverage/LEVERAGE-REPORT.md:101`).

### 8. not applicable - Research provenance should not become normative reading

The fix for research discoverability is not to add all research to default nav.
`docs/research/README.md` says research is dormant provenance, excluded from docs
navigation, and subordinate to design (`docs/research/README.md:8`,
`docs/research/README.md:10`, `docs/research/README.md:13`). `AGENTS.md` treats
incident postmortems and research as context, not spec (`AGENTS.md:35`).

Promote only stable decisions, requirements, or story criteria into `docs/design`,
`docs/implementation`, or `docs/engineering`.

## Follow-up candidates
Add a short physical architecture map after the package tree stabilizes; patch stale
package-state prose in `AGENTS.md`, `packages/README.md`, `packages/sdk/README.md`, and
`packages/sdk/src/README.md`; add a canonical long-work runbook or ExecPlan convention
beside story contracts; keep `docs/research` out of normative nav while active reports
maintain local README/runbook handoff state.
