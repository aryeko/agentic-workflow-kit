---
"@agentic-workflow-kit/orchestrator": minor
---

Make autonomous launch defaults conservative and remove a non-functional control:

- Non-dry-run story launches now require explicit `--yes` / `confirmNonDryRun` approval.
- `workflow-init` defaults new repos to the conservative `push-only` preset; auto-merge presets are an explicit opt-in.
- Repo-relative path validation is hardened (absolute and `..`-escaping paths are rejected).
- The inert `costUsd` budget dimension is removed; configs that set `budget.costUsd` are now rejected by the strict schema.
