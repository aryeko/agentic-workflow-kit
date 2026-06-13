← [Back to README](./README.md)

# Quality bars

| ID | Quality bar | Applies to |
| --- | --- | --- |
| Q-1 | Workflow contracts are documented, validated, and stable enough for downstream automation. | Config, PRDs, HLDs, tracks, artifacts |
| Q-2 | Runtime state is durable across parent session timeout, process restart, and user interruption. | Runs, child sessions, artifacts |
| Q-3 | The runtime stops safely on ambiguous state instead of silently relaunching, merging, or deleting branches. | Autopilot, recovery, GitHub gates |
| Q-4 | Each agent profile can declare prompt/template defaults, model, reasoning effort, structured output contract, permissions, and budget policy. | Implementer, reviewer, planner, analyzer, recovery agent |
| Q-5 | Observability captures enough raw and derived data to independently verify time, token, tool, and outcome metrics. | Run artifacts, reports, MCP tools |
| Q-6 | CLI/MCP status and control surfaces remain usable during long-running runs. | Watch, subscribe, abort, inspect |
| Q-7 | GitHub integration handles PR checks, review comments, reactions, merge policy, and branch cleanup predictably. | V1 collaboration flow |
| Q-8 | Codex is fully supported in V1, but product concepts avoid Codex-only coupling where provider-neutral contracts are required. | Runtime, artifacts, workflow docs |
| Q-9 | Documentation explains adoption, presets, safety tradeoffs, migration, recovery, and artifact interpretation. | User docs, examples, PRD/HLD/track docs |
| Q-10 | Defaults favor safety: dry-run, explicit approval, conservative recovery, and no destructive actions unless configured. | New repo adoption |

---
Previous: [05-phases](./05-phases.md) · Next: [07-success-metrics](./07-success-metrics.md) · Up: [README](./README.md)
