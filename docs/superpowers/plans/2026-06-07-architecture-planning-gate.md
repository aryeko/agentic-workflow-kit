# Architecture Planning Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a technical architecture gate between PRD authoring and tracker decomposition for complex product work.

**Architecture:** Add a new instruction-first `plan-architecture` skill plus a canonical contract/template. Existing `plan-product` routes users to the right next step, while `plan-track` becomes architecture-aware and blocks complex technical decomposition without the architecture artifact.

**Tech Stack:** Markdown skills/contracts/templates, YAML Codex skill metadata, Vitest repository tests, materialized Codex plugin fixture.

---

### Task 1: Add Failing Tests For Architecture Planning Surface

**Files:**
- Modify: `test/skill-authoring.test.ts`
- Modify: `test/plugin-manifest.test.ts`
- Create: `test/technical-architecture-contract.test.ts`
- Create: `test/technical-architecture-template.test.ts`

- [ ] **Step 1: Extend skill-authoring tests**

Add `plan-architecture` to `skillNames`, `implicitPolicy`, and `skillsWithArguments`. Add assertions that:

- `plan-product` mentions context-rich fast path, blocking questions, assumed flow, and next-step routing.
- `plan-track` mentions the architecture gate, complex technical PRDs, and architecture section citations.

- [ ] **Step 2: Extend plugin-manifest tests**

Add a `ships the plan-architecture skill with frontmatter` test asserting the skill exists, has matching frontmatter, uses `[prd-slug or architecture notes]`, and is user-invocable.

- [ ] **Step 3: Add contract/template tests**

Create tests that require `references/technical-architecture-contract.md` and
`references/templates/technical-architecture-template.md` to contain:

- Context and existing surfaces
- Technical requirements
- System architecture diagram
- Proposed modules/components
- Data/query design
- AI prompts/triggers/tools
- Observability/events/metrics
- Migration/deploy surfaces
- Testing strategy
- Open technical questions
- Inputs for delivery tracker/per-story specs

- [ ] **Step 4: Verify red**

Run:

```bash
pnpm vitest run test/skill-authoring.test.ts test/plugin-manifest.test.ts test/technical-architecture-contract.test.ts test/technical-architecture-template.test.ts
```

Expected: fail because `plan-architecture`, its metadata, and the architecture contract/template do not exist yet.

### Task 2: Implement Architecture Skill, Contract, Template, And Existing Skill Updates

**Files:**
- Create: `skills/plan-architecture/SKILL.md`
- Create: `skills/plan-architecture/agents/openai.yaml`
- Create: `references/technical-architecture-contract.md`
- Create: `references/templates/technical-architecture-template.md`
- Modify: `skills/plan-product/SKILL.md`
- Modify: `skills/plan-product/agents/openai.yaml`
- Modify: `skills/plan-track/SKILL.md`
- Modify: `skills/plan-track/agents/openai.yaml`

- [ ] **Step 1: Write `plan-architecture`**

Create an instruction-first skill that resolves `paths.prdsDir`, reads a conforming PRD, shows:

```text
I will do: ingest PRD/context -> audit existing technical surfaces -> draft assumptions -> ask only blocking questions -> write architecture -> self-review -> suggest /plan-track.
```

It writes `<prdsDir>/<slug>/architecture.md`, follows the contract/template, asks only blocking questions, records safe assumptions, and never clobbers an existing architecture document without confirmation.

- [ ] **Step 2: Write architecture contract and template**

Document the canonical architecture artifact shape and template sections listed in Task 1.

- [ ] **Step 3: Update `plan-product`**

Replace the section-by-section-only interview with a context-rich fast path that ingests notes first, drafts from context, asks only blocking questions, records assumptions, and routes next steps by scope.

- [ ] **Step 4: Update `plan-track`**

Add an architecture gate after the PRD gate. The gate classifies whether architecture is required using PRD signals such as new backend modules, data/schema/query changes, AI prompts/tools/triggers, migrations/deploy surfaces, observability, security boundaries, or multi-system integration. If required and missing, stop and point to `plan-architecture`. If present, read it and require tracker/spec links back to it.

- [ ] **Step 5: Verify green for targeted tests**

Run the targeted Vitest command from Task 1. Expected: pass.

### Task 3: Mirror Fixture And Run Full Gate

**Files:**
- Create/modify mirrored paths under `plugins/agentic-workflow-kit/` matching `.codex-plugin`, `skills`, `references`, `presets`, and `examples`.
- Delete transient files under `docs/superpowers/specs/` and `docs/superpowers/plans/` in the final commit.

- [ ] **Step 1: Mirror source plugin files into fixture**

Copy the changed source plugin files into `plugins/agentic-workflow-kit/` so the existing byte-sync tests pass.

- [ ] **Step 2: Run full gate**

Run:

```bash
pnpm check
```

Expected: pass.

- [ ] **Step 3: Run optional Codex smoke if available**

Run:

```bash
pnpm smoke:codex-plugin
```

Expected: pass when the local Codex CLI/plugin state is available. If it fails because the local Codex CLI/plugin state is unavailable, report the exact blocker.

- [ ] **Step 4: Final cleanup**

Remove the transient spec/plan files and commit durable changes only.

- [ ] **Step 5: Publish PR**

Inspect status and diff, commit with a conventional message, push `codex/architecture-planning-gate`, and open a ready PR.
