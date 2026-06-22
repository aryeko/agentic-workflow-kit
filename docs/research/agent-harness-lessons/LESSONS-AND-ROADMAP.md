# Lessons and roadmap

This document summarizes what kit-vnext should learn, what it should keep, and which candidate
improvements should be turned into future docs/story work.

## What we learn

The articles converge on one main lesson: agent quality is a harness property. Better prompts help,
but the durable leverage comes from repo-local knowledge, explicit boundaries, mechanical checks,
queryable evidence, isolated workspaces, resumable plans, and feedback loops that convert mistakes
into tests or docs.

For kit-vnext, the practical lessons are:

- Treat agent legibility as a readiness criterion. A worker or runner should be able to locate the
  right docs, inspect current state, run the right checks, and find proof without human pastebacks.
- Keep the top-level agent contract small. Deep detail belongs in owned design, engineering,
  implementation, and research artifacts.
- Make long work restartable. Plans/runbooks need progress, discoveries, decisions, validation, and
  outcomes; the event log still remains the authority for run truth.
- Convert raw activity into structured evidence. Tool calls, command output, review state, task
  snapshots, and artifacts should feed typed records before human summaries.
- Copy Symphony's daemon mechanics selectively: repository-owned workflow contract, strict parsing,
  workspace root checks, reconciliation-before-dispatch, retry/backoff, dynamic reload, and
  last-known-good config. Do not copy its volatile state or high-trust sample policy.
- Use Responses-style tools as provider capabilities, not as control-plane shortcuts. Tool access,
  stateful conversations, hosted containers, shell, and custom functions need seams, attestations,
  redaction, and fail-closed behavior.
- Add a physical repo map when the package tree stabilizes enough that a contributor can benefit
  from "where do I edit?" guidance.

## What we already do better and should keep

- Keep the deterministic control plane. Do not replace control decisions with an LLM orchestrator.
- Keep the event log as the single source of run truth. Plans, dashboards, provider state, and human
  summaries are secondary.
- Keep worker/runner isolation. Workers implement and commit locally; runners own credentialed and
  irreversible actions.
- Keep capability attestation as the autonomy gate. Missing, stale, negative, or unproven capability
  means the dependent power stays off.
- Keep evidence over prose. Worker self-report should never satisfy completion, merge, recovery, or
  capability gates by itself.
- Keep two authorities separate. Work Source owns task status; run event log owns run activity.
- Keep the local gate strong and cheap-first. The current `pnpm check` chain is an agent-friendly
  feedback loop and should not be weakened to pass transient work.
- Keep research as source-fit prior art, not normative spec. Promote only stable conclusions into
  design docs, implementation stories, fixtures, tests, or engineering policy.

## Improvement roadmap

| Rank | Improvement | Why | Suggested owner surface |
|---:|---|---|---|
| 1 | Fix package-state prose drift. | Stale entry docs are agent-seeding hazards; workers copy nearby false claims. | Patch `AGENTS.md`, `packages/README.md`, `packages/sdk/README.md`, and `packages/sdk/src/README.md` in a small docs hygiene story. |
| 2 | Add a canonical long-work runbook / ExecPlan convention. | Long tasks need compaction-safe state, but runbooks must remain subordinate to event-log truth. | `docs/engineering/` or `docs/implementation/work-item-authoring-guide.md`; include progress, discoveries, decisions, validation, outcomes. |
| 3 | Add a physical architecture map after package stabilization. | Matklad's main gap applies: logical design is strong, but "where do I edit?" will become harder as packages fill out. | A short `ARCHITECTURE.md` or `docs/engineering/code-map.md` linked from `AGENTS.md`. |
| 4 | Turn `core-07` into concrete story contracts. | Observability is designed but not runtime; agent-harness quality depends on analysis reports, metric honesty, and eval fixtures. | `docs/implementation/epics/epic-3-core-runtime-spine/` and `docs/implementation/domains/core/core-07-observability-and-analysis.md`. |
| 5 | Add local eval/report fixtures before external exporters. | Responses and LangChain prior art argue for traces/evals, but kit-vnext needs deterministic local proof first. | `testkit` and `core-07` stories: golden reports, issue datasets, feedback imports, metric-state assertions. |
| 6 | Make docs/package freshness a recurring hygiene track. | Harness engineering warns that agent drift accumulates; current README drift is evidence. | Work Source hygiene stories plus tests that compare package README claims with exports/source surfaces. |
| 7 | Apply Symphony retry/reconciliation patterns with durable state. | Symphony has useful daemon mechanics, but volatile blocked/retry state is weaker than kit-vnext's event-log model. | `core-04`, `core-06`, Work Source provider, and run lifecycle stories. |
| 8 | Keep raw tracker/tool access out of workers by default. | Symphony's `linear_graphql`-style power is flexible but too broad for kit-vnext's safety model. | Work Source and Forge provider stories should prefer narrow typed operations and scoped credentials. |
| 9 | Add outcome metrics to analysis. | Product quality should measure blocked-run rate, approval latency, recovery time, review closure, rerun count, and time to diagnosis. | `core-07` analysis schema and reports. |

## Why this improves the project

These changes move kit-vnext toward a bulletproof harness without weakening its differentiators. The
repo already has the right safety architecture; the next step is making that architecture more legible,
more mechanically enforced, and more observable as runtime behavior lands.

The highest-value work is therefore not adopting another orchestrator or API as the core. It is turning
the source lessons into kit-native artifacts: story criteria, conformance fixtures, eval datasets,
strict config parsing, durable recovery events, and small hygiene checks that prevent stale guidance
from becoming future implementation input.

## Non-goals from this research

- Do not add a full autonomous approval mode to v1.
- Do not make provider state, dashboards, or runbooks authoritative over the event log.
- Do not expose raw tracker mutation or broad shell access to workers as a default capability.
- Do not replace the design corpus with copied external patterns.
- Do not make research reports part of the normative docs flow unless a conclusion is promoted into
  design, implementation, or engineering policy.
