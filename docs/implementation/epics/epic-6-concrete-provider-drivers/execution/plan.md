# Epic 6 Execution Package Plan

## Source Baseline

- Repo path: `/Users/aryekogan/repos/workflow-kit`.
- Package worktree path: `/Users/aryekogan/repos/workflow-kit/.worktrees/plan-delivery-epic-6`.
- Base branch: `v-next`.
- Package branch: `codex/plan-delivery-epic-6`.
- HEAD inspected: `fcb2a621724faa3a36f83f41f19f26442f260c0a`.
- Epic slug: `epic-6-concrete-provider-drivers`.
- Package author/date: Codex, 2026-06-27.
- Source inventory: `docs/implementation/epics/epic-6-concrete-provider-drivers/story-dag.md` plus the 4 ready source story contracts listed below. Every story row and prompt cites source story id and source AC ids.

Source files read:
- `AGENTS.md`
- `CLAUDE.md`
- `docs/implementation/epics/epic-6-concrete-provider-drivers/README.md`
- `docs/implementation/epics/epic-6-concrete-provider-drivers/story-dag.md`
- `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/README.md`
- `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/prov-01-s3-codex-agent-driver.md`
- `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/prov-02-s3-github-forge-driver.md`
- `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/prov-03-s3-markdown-work-source-driver.md`
- `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/prov-04-s3-local-execution-host-driver.md`
- `.agents/skills/plan-delivery/references/source-readiness.md`
- `.agents/skills/plan-delivery/references/package-layout.md`
- `.agents/skills/plan-delivery/references/model-routing.md`
- `.agents/skills/plan-delivery/references/plan-artifact.md`
- `.agents/skills/plan-delivery/references/tracker-artifact.md`
- `.agents/skills/plan-delivery/references/implementer-prompt.md`
- `.agents/skills/plan-delivery/references/reviewer-prompt.md`
- `.agents/skills/plan-delivery/references/closeout-validation.md`
- `docs/implementation-authoring/delivery-pipeline/30-plan-delivery.md`

## Readiness Verdict

Ready. Gate 1 passed for `epic-6-concrete-provider-drivers`: `docs/implementation/epics/epic-6-concrete-provider-drivers/story-dag.md` is `status: "story-dag: frozen"`, every selected source contract is `status: "story: ready"`, and all selected stories have stable ids, ordered AC ids, dependency data, owned pathsets, source scope, and DAG suggested-tier floors. No selected STOP condition or predicate input overlaps an AC or failure/degraded trigger without a declared source value. The package is projectable without adding scope, changing ACs, reordering dependencies, changing owned pathsets, lowering suggested-tier floors, or binding provider-specific runtime model ids.

## Implementation-Readiness Evidence

`$plan-delivery` performed deterministic package validation and independent read-only review for this execution package and marks it `ready_for_implementation`.

Selected stories covered:
- `prov-03-s3-markdown-work-source-driver` from `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/prov-03-s3-markdown-work-source-driver.md` covering `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`
- `prov-04-s3-local-execution-host-driver` from `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/prov-04-s3-local-execution-host-driver.md` covering `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`
- `prov-02-s3-github-forge-driver` from `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/prov-02-s3-github-forge-driver.md` covering `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`
- `prov-01-s3-codex-agent-driver` from `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/prov-01-s3-codex-agent-driver.md` covering `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10`

Artifact checks performed:
- `plan.md`: source baseline, readiness verdict, projection summary, execution waves, prompt inventory, verification policy, downstream execution metadata, resume semantics, and stop point are present and project only from the frozen DAG plus selected ready contracts.
- `tracker.md`: every selected story has one canonical tracker row with initial `ready` status, empty runtime evidence fields, source story id, source AC ids, dependency wave, prompt paths, routing, and `merged` unlock semantics.
- Implementer prompts: all 4 selected stories have exactly one `execution/prompts/<story-id>/implementer.md` with assigned routing, exact task, required reading, source ACs, allowed writes, dependency inputs, non-goals, STOP conditions, implementation constraints, verification, delivery report, and mutation limits.
- Reviewer prompts: all 4 selected stories have exactly one `execution/prompts/<story-id>/reviewer.md` with assigned routing, original scope, runtime slots, checklist, verdict format, and mutation limits.
- Package layout: the package contains one plan, one tracker, and 8 prompts under `docs/implementation/epics/epic-6-concrete-provider-drivers/execution/`.
- Static checks: no provider-specific runtime model ids, fake tracker commit hashes, invalid tracker statuses, missing prompt pairs, extra prompt directories, scaffold markers, or prompt/source AC mismatches remain.
- Source-readiness preflights: substrate-presence (PD-9), predicate-input (PD-10), failure-token/catalog closure (PD-11), manifest/gate-lane coverage (PD-12), phantom-consumer, pure/value classifier, and safety-action provenance checks passed from the frozen DAG and ready contracts. Failure/degraded tokens resolve to prior frozen Epic 2 or Epic 1 catalogs and each story's manifest maps every spec-surface item to source AC ids plus standing gate lanes.
- Deterministic package validation commands:
  - `find docs/implementation/epics/epic-6-concrete-provider-drivers/execution -type f -print | sort | wc -l` -> `10`.
  - `find docs/implementation/epics/epic-6-concrete-provider-drivers/execution/prompts -mindepth 1 -maxdepth 1 -type d -print | wc -l` -> `4`.
  - `find docs/implementation/epics/epic-6-concrete-provider-drivers/execution/prompts -name implementer.md -print | wc -l` -> `4`.
  - `find docs/implementation/epics/epic-6-concrete-provider-drivers/execution/prompts -name reviewer.md -print | wc -l` -> `4`.
  - Unfinished-marker scan over `docs/implementation/epics/epic-6-concrete-provider-drivers/execution` -> no matches.
  - Provider-specific runtime model id / model alias scan over `docs/implementation/epics/epic-6-concrete-provider-drivers/execution` -> no matches.
  - `rg -n '^\| `[^`]+` \| `ready` \|' docs/implementation/epics/epic-6-concrete-provider-drivers/execution/tracker.md` -> 4 initial `ready` tracker rows.
- Docs navigation: after removing generated parent nav changes to test the strict package-boundary interpretation, `pnpm docs:nav:check` failed with `Nav out of date: 2/337 files would change`, proving the repo gate requires generated navigation for the new package Markdown. `pnpm docs:nav` then updated `2/337` files. The only out-of-package side effects are generated `DOCS-NAV` blocks in `docs/implementation/epics/epic-6-concrete-provider-drivers/README.md` and `docs/implementation/epics/epic-6-concrete-provider-drivers/stories/README.md`.
- Repo gate: `pnpm docs:nav:check` reported `Nav up to date (337 files)` after generation. `pnpm check` reported Turbo `Tasks: 8 successful, 8 total`; lint replayed pre-existing warnings in `packages/sdk/src/core/supervision/contracts/interfaces.ts` and `packages/sdk/tests/core/supervision/wait/wait-wrapper.unit.test.ts`, but the gate exit code was 0.

Independent reviewer verdict:
- Reviewer: SpecLawyer (`019f074b-dbb0-77f1-8c78-9783a275a88e`), read-only, dispatched after local package validation.
- Scope: quality, correctness, compliance, and readiness against the plan-delivery references, closeout checklist, frozen DAG, selected ready story contracts, and generated execution package.
- Initial result: two blocking findings. Finding 1 challenged generated parent docs-nav block updates as outside the package boundary. After the package-boundary test above showed `docs:nav:check` fails without those generated blocks, the reviewer withdrew finding 1 as blocking, with the condition that the side effects remain exactly generated nav-block maintenance. Finding 2 required durable closeout evidence in this plan; the command results above are the package-local closeout evidence.
- Result after follow-up: no remaining blocking findings.

Final verdict:
- `ready_for_implementation`

## Projection Summary

| story id | source AC ids | job | wave | dependencies | dependents | owned pathset | suggested-tier floor | routing |
|---|---|---|---|---|---|---|---|---|
| `prov-03-s3-markdown-work-source-driver` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` | Implement the concrete Markdown Work Source driver, including tracker parsing, race-safe mutation, TaskSnapshot artifacts, capability evidence, and real-driver conformance. | 1 | none | Epic 7 production composition | `packages/provider-markdown/src/**`<br>`packages/provider-markdown/tests/**`<br>`packages/provider-markdown/package.json`<br>`packages/provider-markdown/tsconfig.json` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; reviewer: frontier-reviewer; effort high; reasoning elevated; rationale: source story `prov-03-s3-markdown-work-source-driver` covers `AC-1`..`AC-8` and carries a public provider package, real-driver conformance, race-safe task-status authority, capability evidence, failure-token closure, and boundary purity. |
| `prov-04-s3-local-execution-host-driver` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` | Implement the concrete Local Execution Host driver, including workspace attachment, command capture, worker spawn/observation, termination proof, egress attestation, and real-driver conformance. | 1 | none | `prov-01-s3-codex-agent-driver`; Epic 7 production composition | `packages/provider-local/src/**`<br>`packages/provider-local/tests/**`<br>`packages/provider-local/package.json`<br>`packages/provider-local/tsconfig.json` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; reviewer: frontier-reviewer; effort high; reasoning elevated; rationale: source story `prov-04-s3-local-execution-host-driver` covers `AC-1`..`AC-9` and carries a public provider package, process/containment and credential-injection safety boundary, smoke-real evidence, conformance, failure-token closure, and boundary purity. |
| `prov-02-s3-github-forge-driver` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` | Implement the concrete GitHub Forge driver, including exact-head reads/actions, PR/comment/evidence/update/enqueue/merge operations, credential-scoped redaction, and real-driver conformance. | 1 | none | Epic 7 production composition | `packages/provider-github/src/**`<br>`packages/provider-github/tests/**`<br>`packages/provider-github/package.json`<br>`packages/provider-github/tsconfig.json` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; reviewer: frontier-reviewer; effort high; reasoning elevated; rationale: source story `prov-02-s3-github-forge-driver` covers `AC-1`..`AC-8` and carries a public provider package, credentialed remote-write safety boundary, exact-head invariants, smoke-real evidence, conformance, failure-token closure, and boundary purity. |
| `prov-01-s3-codex-agent-driver` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10` | Implement the concrete Codex Agent driver, including versioned schema probes, normalized events, approval answer mapping, resume, tool output refs, Guardian observations, parentage evidence, and real-driver conformance. | 2 | `prov-04-s3-local-execution-host-driver` | Epic 7 production composition and core approval/liveness consumers at runtime | `packages/provider-codex/src/**`<br>`packages/provider-codex/tests/**`<br>`packages/provider-codex/package.json`<br>`packages/provider-codex/tsconfig.json`<br>`tests/providers/codex-local-parentage.smoke.test.ts` | `elevated` | implementer: strong-coder; effort high; reasoning elevated; reviewer: frontier-reviewer; effort high; reasoning elevated; rationale: source story `prov-01-s3-codex-agent-driver` covers `AC-1`..`AC-10` and carries a public provider package, Agent event normalization, approval relay safety boundary, Guardian advisory boundary, Local/Codex parentage dependency, smoke-real evidence, conformance, failure-token closure, and boundary purity. |

## Execution Waves

The execution stage must follow the topological bands from `docs/implementation/epics/epic-6-concrete-provider-drivers/story-dag.md`. A dependent story can start only after every direct dependency row is `merged` in `tracker.md`: the dependency implementation commits have been approved, merged back to the track branch, and recorded with merge-back evidence. `approved`, `in_review`, or committed-without-merge states do not unlock dependents.

| wave | stories |
|---|---|
| 1 | `prov-03-s3-markdown-work-source-driver`, `prov-04-s3-local-execution-host-driver`, `prov-02-s3-github-forge-driver` |
| 2 | `prov-01-s3-codex-agent-driver` |

## Prompt Inventory

| source story | source AC ids | implementer prompt | reviewer prompt |
|---|---|---|---|
| `prov-03-s3-markdown-work-source-driver` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` | `docs/implementation/epics/epic-6-concrete-provider-drivers/execution/prompts/prov-03-s3-markdown-work-source-driver/implementer.md` | `docs/implementation/epics/epic-6-concrete-provider-drivers/execution/prompts/prov-03-s3-markdown-work-source-driver/reviewer.md` |
| `prov-04-s3-local-execution-host-driver` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9` | `docs/implementation/epics/epic-6-concrete-provider-drivers/execution/prompts/prov-04-s3-local-execution-host-driver/implementer.md` | `docs/implementation/epics/epic-6-concrete-provider-drivers/execution/prompts/prov-04-s3-local-execution-host-driver/reviewer.md` |
| `prov-02-s3-github-forge-driver` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8` | `docs/implementation/epics/epic-6-concrete-provider-drivers/execution/prompts/prov-02-s3-github-forge-driver/implementer.md` | `docs/implementation/epics/epic-6-concrete-provider-drivers/execution/prompts/prov-02-s3-github-forge-driver/reviewer.md` |
| `prov-01-s3-codex-agent-driver` | `AC-1`, `AC-2`, `AC-3`, `AC-4`, `AC-5`, `AC-6`, `AC-7`, `AC-8`, `AC-9`, `AC-10` | `docs/implementation/epics/epic-6-concrete-provider-drivers/execution/prompts/prov-01-s3-codex-agent-driver/implementer.md` | `docs/implementation/epics/epic-6-concrete-provider-drivers/execution/prompts/prov-01-s3-codex-agent-driver/reviewer.md` |

## Verification Policy

Each story must use the targeted checks, evidence-pack items, required sweeps, smoke-real evidence, coverage expectations, and `pnpm check` gate from its source contract. The package does not add or relax checks. Worker and reviewer prompts carry the source quality bar, failure/degraded rows, public import test, boundary sweeps, conformance obligations, and source AC ids.

## Downstream Execution Metadata

- Model class, effort, reasoning tier, suggested-tier floor, and routing rationale are abstract delivery-plan decisions.
- Provider-specific runtime model ids, aliases, and versions are selected later by `orchestrated-delivery` from live provider availability.
- Dependency validity comes from tracker `merged` state and the producer story merge-back recorded in `tracker.md`.
- Tracker write authority belongs to the orchestrator during execution.
- Implementers commit each round in their story worktree; the orchestrator merges approved stories back to the track branch and writes tracker state, but commits no story content itself.
- Commit boundaries follow each source story owned pathset.
- Verifiable evidence wins over worker prose: git state, check output, and live review truth resolve conflicts.

## Resume Semantics

A later execution run resumes from `tracker.md` by reading each row status, round, per-round records, blocker, merge-back hash, gate evidence, prompt paths, and notes. If tracker evidence conflicts with repository state, check output, or live review truth, the run must prefer repository state, check output, and live review truth. `prov-01-s3-codex-agent-driver` is resumable only after `prov-04-s3-local-execution-host-driver` is `merged` and the recorded merge-back contains the Local host process evidence consumed by the Codex parentage smoke harness.

## Stop Point

Package creation ends here. Feature implementation, worker dispatch, review, commits, pushes, PRs, merges, and delivery closeout begin only in a later execution run.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Epic 6 - Concrete provider drivers](../README.md) · **← Prev:** [Epic 6 - Concrete provider drivers](../README.md) · **Next →:** [Implementer Prompt: prov-01-s3-codex-agent-driver](./prompts/prov-01-s3-codex-agent-driver/implementer.md)

<!-- /DOCS-NAV -->
