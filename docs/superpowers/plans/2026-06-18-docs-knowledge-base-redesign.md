# Docs knowledge-base redesign — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the agentic-workflow-kit so its skills produce and maintain a canonical docs knowledge base (indexed pillars, ADRs, domain refs, an authoring standard) kept current by a gated promote-to-canonical loop — all configurable, presets as recommendations.

**Architecture:** The spec is [`docs/superpowers/specs/2026-06-17-docs-knowledge-base-redesign-design.md`](../specs/2026-06-17-docs-knowledge-base-redesign-design.md) — it is the content source of truth; this plan does not re-type prose that the spec and the new contract docs define. Work is in six phases: (1) config foundation in Zod, (2) authoring standard + new canonical templates/contracts, (3) producing-skill updates, (4) tracking/story-model change, (5) the new promote skill + wiring, (6) full-gate verification.

**Tech stack:** TypeScript + Zod (`packages/orchestrator/src/config`), Vitest, Biome, pnpm@11.5.1. Skills/templates/presets/contracts are prompt-and-markdown; provider runtime is the orchestrator package.

## Conventions for every task

- **Mirror rule (enforced by `test/plugin-manifest.test.ts`):** any change under `skills/`, `references/`, `presets/`, `examples/`, or `.codex-plugin/` must be copied byte-identically to `plugins/agentic-workflow-kit/<same path>`. Each task that touches those dirs ends with a mirror step + a `diff -r` verification.
- **Prose authoring is delegated, not placeheld:** for markdown skills/templates/contracts, the implementing subagent authors the full content from the spec + the relevant contract + the OnClass reference (`/Users/aryekogan/repos/on-class-web/docs/`). Each such task lists exact files, the required section structure, and concrete acceptance checks. This is the deliverable content — the subagent writes it in full, no "TBD".
- **Model routing:** Sonnet for config code, skill prompts, contracts, and the authoring standard (nuanced); Haiku for mechanical mirror copies and example-file edits.
- **Verify command:** `pnpm check` (lint + typecheck + test) is the gate. Single file: `pnpm test <path>`. Schema regen: `pnpm generate-schema`. Format: `pnpm format`.
- **Commit cadence:** one commit per task, conventional commits, scoped. Run the task's verification before committing.

---

## Phase 1 — Config foundation (`docs` block in Zod)

### Task 1.1: Add the `docs` block to the Zod config schema

**Files:**
- Modify: `packages/orchestrator/src/config/schema.ts` (add `docs` to `ConfigSchema`, before `.strict()`)
- Modify: `packages/orchestrator/src/runtime/version.ts` (`CURRENT_CONFIG_SCHEMA_VERSION` `0.6.0` → `0.7.0`; leave `MIN_SUPPORTED_CONFIG_SCHEMA_VERSION = '0.6.0'`)
- Test: `packages/orchestrator/tests/config-loader.test.ts`

- [ ] **Step 1: Write the failing test** — add to `config-loader.test.ts`:

```typescript
it('applies docs knowledge-base defaults', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'agentic-workflow-kit-docs-'));
  await writeWorkflowConfig(root, 'version: "0.7.0"\n');
  const config = await loadResolvedConfig({}, root);
  expect(config.version).toBe('0.7.0');
  expect(config.config.docs.preset).toBe('full');
  expect(config.config.docs.paths.designsDir).toBe('docs/architecture/designs');
  expect(config.config.docs.paths.decisionsDir).toBe('docs/architecture/decisions');
  expect(config.config.docs.types.adr.enabled).toBe(true);
  expect(config.config.docs.promote.gate).toBe('track-complete');
  expect(config.config.docs.promote.breadcrumbs).toBe('required');
});
```

(Match the existing test's import of `loadResolvedConfig`, `writeWorkflowConfig`, `mkdtemp`, `os`, `path`. If the resolved config exposes docs under a different accessor than `config.config.docs`, mirror whatever the existing `paths` accessor uses — read the file first.)

- [ ] **Step 2: Run to confirm failure**

Run: `pnpm test packages/orchestrator/tests/config-loader.test.ts`
Expected: FAIL (`docs` undefined / strict-mode rejection on the version-only config).

- [ ] **Step 3: Implement the `docs` block** in `schema.ts`, using the existing `repoRelativePath` and `nonEmpty` helpers and the `.default()` style already in the file:

```typescript
docs: z
  .object({
    preset: z.enum(['lean', 'full']).default('full'),
    index: repoRelativePath.default('docs/README.md'),
    style: repoRelativePath.default('docs/docs-style.md'),
    templatesDir: repoRelativePath.default('.workflow/templates'),
    paths: z
      .object({
        productDir: repoRelativePath.default('docs/product'),
        prdsDir: repoRelativePath.default('docs/product/prds'),
        architectureDir: repoRelativePath.default('docs/architecture'),
        designsDir: repoRelativePath.default('docs/architecture/designs'),
        domainsDir: repoRelativePath.default('docs/architecture/domains'),
        decisionsDir: repoRelativePath.default('docs/architecture/decisions'),
      })
      .default({}),
    types: z
      .object({
        adr: z.object({ enabled: z.boolean().default(true) }).default({}),
        domain: z.object({ enabled: z.boolean().default(true) }).default({}),
        runbook: z.object({ enabled: z.boolean().default(false) }).default({}),
      })
      .default({}),
    promote: z
      .object({
        strategy: z.enum(['terminal-story']).default('terminal-story'),
        gate: z.enum(['track-complete', 'off']).default('track-complete'),
        breadcrumbs: z.enum(['required', 'optional', 'off']).default('required'),
      })
      .default({}),
  })
  .default({}),
```

Note: the legacy top-level `paths.prdsDir` (`docs/prds`) is retained for back-compat; the redesigned skills read `docs.paths.prdsDir`. Record this duplication as a follow-up consolidation in the PR description.

- [ ] **Step 4: Bump the version constant** in `runtime/version.ts`: `CURRENT_CONFIG_SCHEMA_VERSION = '0.7.0'`.

- [ ] **Step 5: Run the test to confirm pass**

Run: `pnpm test packages/orchestrator/tests/config-loader.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/orchestrator/src/config/schema.ts packages/orchestrator/src/runtime/version.ts packages/orchestrator/tests/config-loader.test.ts
git commit -m "feat: add docs knowledge-base config block (schema 0.7.0)"
```

### Task 1.2: Regenerate the JSON schema and update version-compat tests

**Files:**
- Modify (generated): `references/config.schema.json`, `references/config.schema.json` mirror under `plugins/agentic-workflow-kit/references/` if present (check)
- Modify: `packages/orchestrator/tests/config-version.test.ts` (any `0.6.0`-as-current assertion → `0.7.0`; keep min-supported `0.6.0`)
- Modify: `test/config-schema.test.ts` if it pins the current version

- [ ] **Step 1: Regenerate** — Run: `pnpm generate-schema`. Confirm `references/config.schema.json` now contains the `docs` properties.
- [ ] **Step 2: Find version assertions** — Run: `grep -rn "0.6.0" packages/orchestrator/tests test references | grep -v node_modules`. For each that asserts *current* version, update to `0.7.0`; leave *min-supported* and *legacy `version: 1`* assertions as `0.6.0`/`1`.
- [ ] **Step 3: Run** — `pnpm test packages/orchestrator/tests/config-version.test.ts test/config-schema.test.ts`. Expected: PASS.
- [ ] **Step 4: Commit** — `git commit -am "chore: regenerate config schema for docs block"`.

### Task 1.3: Document the `docs` block in `config-schema.md` (satisfies `config-doc-sync`)

**Files:**
- Modify: `references/config-schema.md` + mirror `plugins/agentic-workflow-kit/references/config-schema.md`
- Test: `test/config-doc-sync.test.ts`

The test parses `## \`<prefix>\`` section headers and `| \`key\` | type | default |` rows, and asserts: every schema property documented, no stale rows, exact defaults, exact enum members. It also asserts the literal version strings.

- [ ] **Step 1: Add a `## \`docs\`` section** documenting every leaf path exactly as the schema defines it. Required rows (path → type → default), matching the test's `sectionPrefix.key` derivation:

```
## `docs`

| Key | Type | Default |
| --- | --- | --- |
| `preset` | enum (`lean`, `full`) | `full` |
| `index` | repo-relative path | `docs/README.md` |
| `style` | repo-relative path | `docs/docs-style.md` |
| `templatesDir` | repo-relative path | `.workflow/templates` |

## `docs.paths`

| Key | Type | Default |
| --- | --- | --- |
| `productDir` | repo-relative path | `docs/product` |
| `prdsDir` | repo-relative path | `docs/product/prds` |
| `architectureDir` | repo-relative path | `docs/architecture` |
| `designsDir` | repo-relative path | `docs/architecture/designs` |
| `domainsDir` | repo-relative path | `docs/architecture/domains` |
| `decisionsDir` | repo-relative path | `docs/architecture/decisions` |

## `docs.types.adr`

| Key | Type | Default |
| --- | --- | --- |
| `enabled` | boolean | `true` |

## `docs.types.domain`

| Key | Type | Default |
| --- | --- | --- |
| `enabled` | boolean | `true` |

## `docs.types.runbook`

| Key | Type | Default |
| --- | --- | --- |
| `enabled` | boolean | `false` |

## `docs.promote`

| Key | Type | Default |
| --- | --- | --- |
| `strategy` | enum (`terminal-story`) | `terminal-story` |
| `gate` | enum (`track-complete`, `off`) | `track-complete` |
| `breadcrumbs` | enum (`required`, `optional`, `off`) | `required` |
```

(Confirm the exact column header / enum-rendering the test expects by reading sibling sections in `config-schema.md` first — `documentedEnums` extracts back-ticked tokens from the type cell, so list every enum member in back-ticks.)

- [ ] **Step 2: Update the version strings** — change `Current config schema version: \`0.6.0\`` → `0.7.0`, and `New configs should use \`version: "0.6.0"\`` → `0.7.0`. Update the matching assertions in `test/config-doc-sync.test.ts` (lines ~136-138). Keep min-supported `0.6.0` and the legacy `version: 1` line.
- [ ] **Step 3: Mirror** to `plugins/agentic-workflow-kit/references/config-schema.md` (and the JSON schema if mirrored). Run: `diff -r references plugins/agentic-workflow-kit/references` → no diff for changed files.
- [ ] **Step 4: Run** — `pnpm test test/config-doc-sync.test.ts`. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -am "docs: document docs config block in config-schema.md"`.

### Task 1.4: Phase-1 gate

- [ ] Run `pnpm check`. Expected: PASS. Fix any fallout before Phase 2.

---

## Phase 2 — Authoring standard + new canonical templates and contracts

All new files live under `references/` and are mirrored to `plugins/agentic-workflow-kit/references/`. Content is authored from the spec (§ "Authoring standard", "Doc-type catalog", "Diagrams as a craft") and the OnClass reference docs.

### Task 2.1: Author the `docs-style.md` template

**Files:**
- Create: `references/templates/docs-style.md` (the seed the kit writes into a repo) + mirror
- Reference model: `on-class-web/docs/architecture/docs-style.md`

- [ ] **Step 1: Author** the standard with these sections (from spec): required frontmatter (`title`, `status`, `owner`, `last-reviewed`, `related`); the closed `status` vocabulary table scoped per doc family (canonical: `draft`/`approved`/`deprecated`; ADR: `proposed`/`accepted`/`superseded by NNNN`; PRD/design: `draft`/`approved`/`shipped`/`archived`); one-fact-one-place; structure rules (H1 + italic TL;DR + Context + body + Related; sentence-case headings; active voice; relative links; code fences with language tags; Mermaid not screenshots); the diagram type-picker table + the preamble→diagram→takeaway rule; and an `extends: built-in/recommended` note for consumer overrides.
- [ ] **Step 2: Acceptance** — file has frontmatter, all three status-family rows, the diagram type-picker table, and the preamble→diagram→takeaway rule. Sentence-case headings. No `<slug>`-style placeholders left as TODO.
- [ ] **Step 3: Mirror + verify** (`diff`), then **commit**: `docs: add docs-style authoring standard template`.

### Task 2.2: Author the ADR template + contract

**Files:**
- Create: `references/templates/adr-template.md`, `references/adr-contract.md` + mirrors
- Reference: `on-class-web/docs/architecture/decisions/0001-*.md`

- [ ] **Step 1: Author the ADR template** (MADR): frontmatter (`title`, `status: proposed|accepted|superseded by NNNN`, `date`, `deciders`, `related`); sections Context · Decision · Consequences (Positive/Negative/Neutral) · Alternatives considered · Related. Numbering `NNNN-kebab-title.md`, immutable.
- [ ] **Step 2: Author `adr-contract.md`** describing the required structure, the immutability/stable-numbering rule, and that `promote-to-canonical` mints ADRs.
- [ ] **Step 3: Acceptance** — template has all five MADR sections + the three Consequences sub-buckets; contract states stable-numbering + immutability.
- [ ] **Step 4: Mirror + verify + commit**: `docs: add ADR template and contract`.

### Task 2.3: Author the domain-reference template + contract

**Files:**
- Create: `references/templates/domain-reference-template.md`, `references/domain-reference-contract.md` + mirrors
- Reference: `on-class-web/docs/architecture/domains/training.md` and `domains/README.md`

- [ ] **Step 1: Author the template**: frontmatter + sections Purpose · Public API · Invariants · Gotchas · Related code.
- [ ] **Step 2: Author the contract** describing those sections and that domain refs are canonical, maintained by `promote-to-canonical`.
- [ ] **Step 3: Acceptance** — all five sections present; contract names the maintainer skill.
- [ ] **Step 4: Mirror + verify + commit**: `docs: add domain-reference template and contract`.

### Task 2.4: Author master-index and pillar-index templates

**Files:**
- Create: `references/templates/index/master-readme-template.md`, `references/templates/index/pillar-readme-template.md` + mirrors
- Reference: `on-class-web/docs/README.md`, `docs/architecture/README.md`, `docs/product/README.md`

- [ ] **Step 1: Author the master index template**: frontmatter + Context + a reading-journey Mermaid flowchart + the three-pillar table + the "I need to X → read Y" routing table + a pointer to `docs-style.md`.
- [ ] **Step 2: Author the pillar index template**: TL;DR + "Start here" (2-3 links) + "I need to … → read …" table + grouped topic links + Related. Parameterized for product vs architecture.
- [ ] **Step 3: Acceptance** — master template has the reading-journey diagram + both tables; pillar template has Start-here + routing table.
- [ ] **Step 4: Mirror + verify + commit**: `docs: add master and pillar index templates`.

### Task 2.5: Phase-2 gate

- [ ] Run `pnpm check`. Expected: PASS (the marketplace-mirror test now also checks the new files exist identically under `plugins/`). Fix mirror drift if any.

---

## Phase 3 — Producing-skill updates

Each task edits `skills/<skill>/SKILL.md` and mirrors to `plugins/agentic-workflow-kit/skills/<skill>/SKILL.md`. Read the current SKILL.md first; preserve frontmatter (`name`, `description`, `argument-hint`, `user-invocable`) — `test/plugin-manifest.test.ts` pins those.

### Task 3.1: `workflow-init` — scaffold the knowledge base

- [ ] **Step 1:** Extend the skill so that, after writing `.workflow/config.yaml`, it scaffolds (per `docs.preset`): the master index (`docs.index`), `docs-style.md` (`docs.style`, seeded from `references/templates/docs-style.md`), both pillar indexes, and an `architecture/guidelines.md` stub (lean). The `full` preset additionally scaffolds `docs.paths.domainsDir` (+ `domains/README.md`), `docs.paths.decisionsDir` (+ ADR template copy), `qa/`, and `runbooks/` stubs.
- [ ] **Step 2:** Add "detect, don't impose": before scaffolding, the skill inspects the existing layout and maps `docs.paths.*` onto found dirs (e.g. existing `docs/adr/` → `decisionsDir: docs/adr`) instead of creating new ones. Idempotent; never clobbers.
- [ ] **Step 3:** Reference templates via `${CLAUDE_PLUGIN_ROOT}/references/templates/...` (match existing placeholder syntax in the skill).
- [ ] **Step 4: Acceptance** — skill text covers lean vs full scaffolding, reads `docs.*` config, and has the detect-not-impose step. Frontmatter unchanged.
- [ ] **Step 5:** Mirror + `diff` verify + run `pnpm test test/plugin-manifest.test.ts` → PASS. **Commit**: `feat: scaffold docs knowledge base in workflow-init`.

### Task 3.2: `define-product` — read canonical, register in pillar index

- [ ] **Step 1:** Add an input step: read current canonical docs (`docs.paths.productDir`, `architectureDir`) as context before drafting.
- [ ] **Step 2:** PRDs are written under `docs.paths.prdsDir` (`docs/product/prds`); after writing, register the PRD in the product pillar index. Conform output to `docs-style.md`.
- [ ] **Step 3: Acceptance** — skill reads canonical first and updates the pillar index; PRD path uses `docs.paths.prdsDir`.
- [ ] **Step 4:** Mirror + verify + **commit**: `feat: read canonical and register PRD in define-product`.

### Task 3.3: `design-technical-solution` — move design to `architecture/designs/`, add canonical-impact

- [ ] **Step 1:** Change the output location from `<prdsDir>/<slug>/technical-solution.md` to `docs.paths.designsDir/<slug>.md` (`architecture/designs/<slug>.md`), `status`-tracked staging. Add a back-compat note: still read an existing `technical-solution.md` if present.
- [ ] **Step 2:** Add a required **Canonical impact** section to the template `references/templates/technical-solution-template.md` (+ mirror) and to `technical-solution-contract.md` (+ mirror): enumerate which canonical docs / domain refs / ADRs the design will create or change on promotion.
- [ ] **Step 3: Acceptance** — skill writes to `designsDir`; template + contract include the Canonical impact section.
- [ ] **Step 4:** Mirror all changed files + verify + run `pnpm test test/plugin-manifest.test.ts`. **Commit**: `feat: stage technical design under architecture/designs with canonical-impact`.

### Task 3.4: Phase-3 gate

- [ ] Run `pnpm check`. Expected: PASS.

---

## Phase 4 — Tracking and the grow-in-place story model

This is the most test-coupled phase (`example-tracker`). Read `references/story-brief-contract.md`, `references/detailed-story-spec-contract.md`, `skills/plan-delivery-track/SKILL.md`, and `skills/implement-next/SKILL.md` first.

### Task 4.1: Collapse to a single grow-in-place story spec

- [ ] **Step 1:** Update `references/story-brief-contract.md` (rename concept to "story spec" or keep filename, document the grow-in-place lifecycle): `plan-delivery-track` writes brief-level sections; `implement-next` enriches the *same file* to implementation-ready (files-to-touch, acceptance, verification, resolved decisions). `status` column tracks maturity (`specced` = brief, `plan-approved` = implementation-ready). Add the one-line **canonical impact** field.
- [ ] **Step 2:** Update `references/templates/story-brief-template.md` to include the canonical-impact line and the (initially empty) implementation-ready sections.
- [ ] **Step 3:** Update `skills/plan-delivery-track/SKILL.md` and `skills/implement-next/SKILL.md`: the latter enriches the story file in place instead of creating a separate `docs/specs/<...>` doc. Note `specsDir` is retained but de-emphasized.
- [ ] **Step 4: Acceptance** — contract + template + both skills describe one file growing through `specced`→`plan-approved`; canonical-impact present.
- [ ] **Step 5:** Mirror all changed files + verify. **Commit**: `feat: grow-in-place story spec replacing brief plus separate detailed spec`.

### Task 4.2: Emit the dependency-terminal promote story

- [ ] **Step 1:** Update `skills/plan-delivery-track/SKILL.md` + `references/tracker-contract.md`: always emit a terminal promote story whose `Depends on` = all implementation stories, final wave, `Spec` links its story file, the story runs `promote-to-canonical`. Add the ground rule: the track is not complete until the promote story reaches a `complete` status (`done`/`verified`). No new status vocabulary.
- [ ] **Step 2: Acceptance** — skill + contract describe the terminal promote story and the track-complete gate; status vocabulary unchanged.
- [ ] **Step 3:** Mirror + verify. **Commit**: `feat: emit dependency-terminal promote story in plan-delivery-track`.

### Task 4.3: Update the bundled example + its test

**Files:** `examples/example-tracker/README.md`, `examples/example-tracker/stories/*.md` (+ mirrors), `test/example-tracker.test.ts`

- [ ] **Step 1:** Add a terminal promote row (e.g. `LK99`) to the example tracker matrix (`Depends on` = LK01..LK03, final wave, a vocab status). Keep the canonical header line intact.
- [ ] **Step 2:** Reconcile the example story files with the grow-in-place model. Decide and apply consistently: if the "not implementation-ready" note is removed by the new model, update `test/example-tracker.test.ts` (lines ~56-63) to assert the new story-spec invariants (e.g. presence of the canonical-impact line and `## Artifact boundaries`) instead. Keep `## Assumptions and blockers`, `## Artifact boundaries`, `Runtime artifacts` if still part of the model.
- [ ] **Step 3: Acceptance** — `pnpm test test/example-tracker.test.ts` PASS with the updated assertions; matrix still matches the canonical header and vocab.
- [ ] **Step 4:** Mirror examples to `plugins/agentic-workflow-kit/examples/` + `diff -r` verify. **Commit**: `test: update example tracker for promote story and grow-in-place specs`.

### Task 4.4: Phase-4 gate

- [ ] Run `pnpm check`. Expected: PASS.

---

## Phase 5 — The `promote-to-canonical` skill + wiring

### Task 5.1: Create the `promote-to-canonical` skill

**Files:** Create `skills/promote-to-canonical/SKILL.md` + mirror; create `references/promote-contract.md` + mirror

- [ ] **Step 1:** Author `SKILL.md` with frontmatter matching the manifest test shape: `name: promote-to-canonical`, a `description`, an `argument-hint` (e.g. `[track or prd-slug]`), `user-invocable: true`. Body (from spec): read the shipped track/PRD, its design doc, the per-story canonical-impact breadcrumbs, and the merged diff; update product narrative + topic docs + domain refs; mint ADR(s) for real decisions; flip the PRD `status` → `shipped`; archive the `architecture/designs/<slug>.md`; refresh pillar indexes. It reads `docs.promote` config + repo-owned standard/templates.
- [ ] **Step 2:** Author `references/promote-contract.md` defining the promote step's inputs, outputs, and the track-complete gate.
- [ ] **Step 3: Acceptance** — frontmatter present and well-formed; body covers all promote actions and reads `docs.*`.
- [ ] **Step 4:** Mirror skill + contract + `diff` verify. **Commit**: `feat: add promote-to-canonical skill and contract`.

### Task 5.2: Register the new skill in AGENTS.md + manifest test

**Files:** `AGENTS.md`, `test/docs-current-state.test.ts`, `test/plugin-manifest.test.ts`

- [ ] **Step 1:** Update the AGENTS.md skill enumeration to include `promote-to-canonical` and update the exact expected substring in `test/docs-current-state.test.ts` (the `workflow-init`, …, `workflow-autopilot` list).
- [ ] **Step 2:** Add an `it('ships the promote-to-canonical skill with frontmatter', ...)` block in `test/plugin-manifest.test.ts` mirroring the existing per-skill blocks (assert `name`, `description`, `argument-hint`, `user-invocable`).
- [ ] **Step 3: Acceptance** — `pnpm test test/docs-current-state.test.ts test/plugin-manifest.test.ts` PASS.
- [ ] **Step 4:** Mirror AGENTS.md change only if AGENTS.md is mirrored (check; it is not under the mirrored dirs — root only). **Commit**: `docs: register promote-to-canonical skill`.

### Task 5.3: Phase-5 gate

- [ ] Run `pnpm check`. Expected: PASS.

---

## Phase 6 — Full verification and handoff

### Task 6.1: Full gate + mirror parity

- [ ] Run `pnpm check` (forced, not cached): expect lint + typecheck + all tests green.
- [ ] Run `diff -r skills plugins/agentic-workflow-kit/skills`, same for `references`, `presets`, `examples` → no differences.
- [ ] Run `pnpm generate-schema` and confirm `git status` shows no uncommitted schema drift.

### Task 6.2: Self-review against the spec

- [ ] Walk each spec section ("Target architecture", "promote lifecycle", "Doc-type catalog", "authoring standard", "diagram craft", "tracking/stories", "configurability", "skill-by-skill") and confirm a task implemented it. List any gaps; add tasks if found.
- [ ] Confirm the spec's "Open questions" resolutions are reflected: schema `0.7.0`; promote story reuses status vocab; promote ships as a skill.

### Task 6.3: PR (after user approval)

- [ ] Push `docs/docs-knowledge-base-redesign`; open a PR using the repo PR conventions (What / How / Test plan / Type / Checklist). Note the retained-legacy `paths.prdsDir` duplication as a follow-up. Do not open the PR until the user approves.

---

## Out of scope (follow-ups)

- Running the new `workflow-init`/promote flow against the kit's own `docs/` (full dogfooding) — separate effort.
- Consolidating legacy top-level `paths.prdsDir` with `docs.paths.prdsDir`.
- A `promote-to-canonical` MCP action (skill-only for now).
- Code-level contract validators (contracts remain prompt-enforced, consistent with the current kit).
