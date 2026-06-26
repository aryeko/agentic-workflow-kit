# Codex Custom-Agent Bindings for Workflow-Kit Planning Skills

## Goal

Update the repo-local workflow-kit skills so Codex custom agents are used explicitly at the correct
planning and orchestration boundaries.

Codex currently exposes custom agents named `reviewer`, `architect`, `researcher`, and
`implementer`. The workflow-kit skills already describe those responsibilities conceptually, but the
skill text does not consistently bind those concepts to Codex `agent_type` values. A later
implementation should remove that inference step while preserving the existing stage separation:

- `plan-epic` authors story DAGs and story contracts, then stops at Gate 1.
- `plan-delivery` projects ready stories into a provider-neutral execution package.
- `orchestrated-delivery` binds runtime facts and executes the packaged worker prompts.

## Current State

The repo-local skills live under:

- `.agents/skills/plan-epic`
- `.agents/skills/plan-delivery`
- `.agents/skills/orchestrated-delivery`

The current skill split is correct and should remain intact. The improvement is a Codex runtime
binding clarification, not a replacement for the existing delivery pipeline.

The key design rule is:

> `plan-delivery` grounds durable roles and prompt contracts; `orchestrated-delivery` maps those
> roles to the current surface's custom agent mechanism.

## Role-Boundary Decisions

### `plan-epic`

When delegating on Codex, bind planning-stage assistant roles to Codex custom agents without making
delegation mandatory on surfaces that do not support it:

- Use `agent_type: "researcher"` for broad read-only source and evidence scans, such as source-doc
  traceability, existing DAG/story inventory, sibling symbol/path checks, and epic readiness evidence.
- Use `agent_type: "architect"` for characterization review, architecture override, design-gap
  escalation, and final ownership of contract/architecture judgment.
- Use `agent_type: "reviewer"` for the final independent read-only Gate 1 review.
- Do not use `agent_type: "implementer"` in `plan-epic`; no feature execution, execution-package
  authoring, or delivery dispatch happens in this stage.

### `plan-delivery`

- When delegating on Codex, use optional `agent_type: "researcher"` for wide source-readiness
  evidence gathering when the readiness surface is broad enough to benefit from bounded read-only
  delegation.
- When delegating on Codex, use `agent_type: "reviewer"` for the independent package-quality and
  implementation-readiness review after local closeout validation.
- Keep generated execution package artifacts provider-neutral. Do not place Codex-specific
  `agent_type` values in `execution/plan.md`, `execution/tracker.md`, or packaged
  `execution/prompts/<story-id>/{implementer,reviewer}.md` files.
- Continue to record package-owned role data as abstract model class, effort, reasoning tier, routing
  rationale, prompt contract, evidence slots, allowed pathset, and escalation target.

### `orchestrated-delivery`

- On Codex surfaces, runtime-bind packaged role prompts to Codex custom agents:
  - implementer prompt -> `agent_type: "implementer"`
  - reviewer prompt -> `agent_type: "reviewer"`
  - source-contract blocker classification or five-round cap escalation review ->
    `agent_type: "architect"`
  - bounded read-only evidence task -> `agent_type: "researcher"`
- Preserve durable route-back ownership for blockers: an `architect` escalation may classify the
  issue, but tracker route-back targets remain `$plan-epic` for frozen story defects and
  `$plan-delivery` for package-only projection defects.
- Keep model class and effort routing separate from role binding. The package-declared model class
  still resolves through `references/providers/openai.md` or the active provider profile.
  `agent_type` controls the behavioral role; it does not replace abstract model routing.
- Reuse the same implementer and reviewer contexts through fix/rereview rounds. Do not spawn a fresh
  replacement worker for each round unless the context is lost or technically impossible to continue.

## Follow-Up Implementation Targets

A follow-up implementation should update the smallest useful set of skill docs:

- `.agents/skills/plan-epic/SKILL.md`
- `.agents/skills/plan-delivery/SKILL.md`
- `.agents/skills/orchestrated-delivery/references/runtime-binding.md`
- `.agents/skills/orchestrated-delivery/references/surface-map.md`
- `.agents/skills/orchestrated-delivery/references/worker-lifecycle.md`
- `.agents/skills/orchestrated-delivery/EVALS.md`
- `.agents/skills/orchestrated-delivery/evals/evals.json`
- `.agents/skills/orchestrated-delivery/evals/trigger_queries.json`

The orchestrated-delivery eval updates are required because its runtime-binding requirements already
assert surface and routing behavior. Update `plan-epic` or `plan-delivery` evals only if their skill
text gains normative custom-agent dispatch behavior. All eval changes must preserve provider-neutral
package artifacts.

## Non-Goals

- Do not edit packaged workflow-kit runtime code as part of this change.
- Do not change the stage boundary between `plan-epic`, `plan-delivery`, and
  `orchestrated-delivery`.
- Do not bake Codex-specific `agent_type` values into generated execution packages.
- Do not replace provider model profiles or abstract model classes with custom-agent names.

## Verification for Follow-Up Implementation

After editing skill files, run:

```bash
python3 "$HOME/.agents/skills/open-skill-creator/scripts/validate_skill.py" .agents/skills/plan-epic
python3 "$HOME/.agents/skills/open-skill-creator/scripts/validate_skill.py" .agents/skills/plan-delivery
python3 "$HOME/.agents/skills/open-skill-creator/scripts/validate_skill.py" .agents/skills/orchestrated-delivery
```

Also run repository checks required by the edited scope, normally:

```bash
pnpm check
```

Use targeted search checks:

```bash
rg -n 'agent_type: "(reviewer|architect|researcher|implementer)"|agent_type' .agents/skills
rg -n 'agent_type' docs/implementation/epics
```

The first check should prove the skill/runtime binding is explicit. The second should not find
Codex-specific `agent_type` values in generated execution-package artifacts unless a future decision
intentionally changes package portability.

## Acceptance Criteria

- A fresh session can read this document and understand the task without this conversation.
- The role decisions for `plan-epic`, `plan-delivery`, and `orchestrated-delivery` are explicit.
- The distinction between provider-neutral package roles and Codex runtime `agent_type` binding is
  preserved.
- The proposed follow-up target files and verification commands are listed.
