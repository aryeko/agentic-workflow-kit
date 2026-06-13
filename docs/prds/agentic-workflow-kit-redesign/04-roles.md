← [Back to README](./README.md)

# Roles

## Personas

- **Solo engineer** - wants a reliable way to turn an idea into a planned, verified PR without
  manually rebuilding the workflow each time.
- **Tech lead** - wants product intent, design decisions, backlog sequencing, and PR evidence to be
  explicit enough to review and delegate.
- **Platform team** - wants repo-level policies, presets, safe defaults, observability, and
  recovery behavior that can be standardized across projects.
- **AI coding workflow builder** - wants provider-conscious contracts, MCP/CLI surfaces, artifacts,
  and extension points for agent hosts and future management UIs.
- **Reviewer / maintainer** - wants to understand what an autonomous run changed, which checks ran,
  which review findings were addressed, and whether merge gates were satisfied.

## Capability matrix

| Capability | Solo engineer | Tech lead | Platform team | Workflow builder | Reviewer / maintainer |
| --- | --- | --- | --- | --- | --- |
| Define or import product context | yes | yes | review | yes | review |
| Design HLD from PRD, docs, or session context | yes | yes | review | yes | review |
| Plan contract-backed tracks | yes | yes | standardize | yes | review |
| Migrate existing backlog into tracker schema | yes | yes | standardize | yes | review |
| Configure autonomy presets | yes | yes | yes | yes | review |
| Configure agent profiles, prompts, models, effort, structured output, and budgets | yes | yes | yes | yes | inspect |
| Launch story-level runtime | yes | yes | yes | yes | inspect |
| Launch track-level autopilot | yes | yes | policy | yes | inspect |
| Inspect realtime status and artifacts | yes | yes | yes | yes | yes |
| Abort or manually recover a run | yes | yes | yes | yes | yes |
| Approve or merge PRs | yes | yes | policy | no | yes |

---
Previous: [03-domain-model](./03-domain-model.md) · Next: [05-phases](./05-phases.md) · Up: [README](./README.md)
