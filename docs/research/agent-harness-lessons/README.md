# Agent harness lessons

## TLDR

This research pass compares kit-vnext against agent-harness practices from OpenAI engineering
articles, the Codex ExecPlan guidance, Matklad's `ARCHITECTURE.md` guidance, OpenAI Responses API
case studies, and the `openai/symphony` specification.

Bottom line: kit-vnext already has stronger safety architecture than the public source patterns in
the areas that matter most for a control plane: event-log authority, worker/runner separation,
capability attestation, evidence gates, and fail-closed behavior. The largest improvements are
harness-quality upgrades around physical repo navigation, long-work runbooks, doc freshness,
observability/evals, and durable retry/reconciliation implementation.

The report answers:

- What guidelines, best practices, and lessons the sources derive.
- Where kit-vnext stands against those guidelines.
- What kit-vnext should learn from them.
- What kit-vnext already does better and should preserve.
- How kit-vnext should improve, and why.

## Report map

- [Research runbook](RESEARCH-RUNBOOK.md)
- [Task narrative](TASK-NARRATIVE.md)
- [Sources](SOURCES.md)
- [Guideline matrix](GUIDELINE-MATRIX.md)
- [Current-state audit](CURRENT-STATE-AUDIT.md)
- [Lessons and roadmap](LESSONS-AND-ROADMAP.md)
- [Source notes](source-notes/README.md)
- [Repository audit notes](repo-audit/README.md)

## Method

The review uses source-fit analysis:

1. Extract source guidance without treating any article as a drop-in product spec.
2. Audit current kit-vnext docs, code, tests, and tooling from live `v-next`.
3. Classify each guideline as something to keep, improve, or investigate.
4. Propose candidate docs/story changes only; no runtime changes are made in this pass.
