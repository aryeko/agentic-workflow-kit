# Surface Map

Use this map from `runtime-binding.md` to bind abstract capabilities to the current surface. If a
surface is not listed, map by closest analogue, record the assumption, and fail closed when a required
mutation or worker-control capability is unavailable.

## Capability Bindings

| Capability | Codex | Claude Code | If Unsupported |
|---|---|---|---|
| `plan-mode` | Manual Plan Mode switch; no programmatic toggle | `EnterPlanMode` / `ExitPlanMode` | Ask for explicit read-only fallback before discovery |
| `exec-checklist` | `update_plan` | `TodoWrite` or task tools | Keep coarse phases in the ledger |
| `worker-spawn` | subagents by default; visible threads only on explicit request | `Agent` tool | Serialize in coordinator context |
| `worker-completion` | subagents: native result; visible threads: wake-file fallback | native tool result or completion notification | bounded sleep on a stable signal |
| `worker-readdress` | continue the same subagent/thread | send a message to the same agent id/name | fresh worker with compact prior-context bundle |
| `worker-naming` | subagent/thread title or ledger alias | agent description/name | ledger alias plus prompt prefix |
| `worker-isolation` | per-story git worktree when needed | agent worktree isolation when available | shared worktree with strict commit lock |
| `worker-close` | subagents close; visible threads archive | close/end agent context | mark only that pair terminal in the ledger |
| `reasoning-tier` | detected effort field | detected effort field | closest supported level |
| `model-routing` | provider profile plus model override when exposed | provider profile plus agent model field when exposed | inherit model and record fallback |
| `prompt-contract` | packaged prompt verification plus ledger status | packaged prompt verification plus ledger status | coordinator executes only if package is complete |
| `worker-cap` | tool or config cap, else 6 | practical parallel cap, else 6 | assume 6 |
| `pr-review-wait` | global `watch-pr` skill | global `watch-pr` skill | inline detect-only review-state read |
| `pr-thread-followup` | global `thread-aware-pr-followup` skill | global `thread-aware-pr-followup` skill | unresolved threads first, then scoped fix |
| `merge-cleanup` | global `repo-cleanup-closeout` skill | global `repo-cleanup-closeout` skill | inline verified closeout |

The global skills live under `~/.agents/skills`. Preserve their boundaries: review waiting detects
state only, review follow-up patches current-head findings, and merge cleanup requires explicit
current user instruction.

## Effort Mapping

Map abstract tiers to the efforts actually exposed by the worker surface:

| Abstract Tier | Default Meaning |
|---|---|
| `light` | mechanical, docs, config, or tightly bounded tests |
| `standard` | default bounded implementation |
| `elevated` | cross-file contracts or concrete safety risk |
| `critical` | architecture, migration, data-loss, or security-boundary risk |

`critical` is the highest supported tier. If a package item appears to need more, refuse execution per
`package-preflight.md`.

## Completion Signals

Use native completion for subagents on both Codex and Claude Code. Use wake files only for explicitly
requested visible-thread workers that lack a native completion signal. A filesystem event is only a
wake; inspect worker output, diffs, checks, or PR state before updating the ledger.
