# Agent harness lessons sources

Access date: 2026-06-22.

## Primary sources

| Source | URL | Scope used |
|---|---|---|
| OpenAI Harness engineering | <https://openai.com/index/harness-engineering/> | Agent-first repo design, legibility, mechanical constraints, autonomy, cleanup loops. |
| OpenAI Codex ExecPlans | <https://developers.openai.com/cookbook/articles/codex_exec_plans> | Living plans, validation, milestones, decision logs, multi-hour Codex work. |
| Matklad `ARCHITECTURE.md` | <https://matklad.github.io/2021/02/06/ARCHITECTURE.md.html> | Short physical architecture maps for contributors. |
| OpenAI Responses API year one | <https://developers.openai.com/blog/one-year-of-responses> | Tool calling, stateful workflows, structured action generation, product-facing agent patterns. |
| `openai/symphony` repository | <https://github.com/openai/symphony> | Isolated autonomous implementation runs and work-management posture. |
| `openai/symphony` specification | <https://github.com/openai/symphony/blob/main/SPEC.md> | Scheduler/runner split, repository-owned workflow contract, workspace isolation, retry/reconciliation, observability. |

Symphony commit used for detailed notes:
[`4cbe3a9699a73b862466c0b157ceca0c1985d6d7`](https://github.com/openai/symphony/tree/4cbe3a9699a73b862466c0b157ceca0c1985d6d7).

## Source notes

- [OpenAI Harness engineering](source-notes/openai-harness-engineering.md)
- [OpenAI Codex ExecPlans](source-notes/codex-exec-plans.md)
- [Matklad ARCHITECTURE.md](source-notes/matklad-architecture-md.md)
- [OpenAI Responses API year one](source-notes/openai-responses-year.md)
- [OpenAI Symphony](source-notes/openai-symphony.md)
