# Model Routing

Assign each story exactly one implementer and one reviewer. Route by story risk, not by convenience
or worker availability.

## Required Fields

Record these routing fields in `plan.md`, `tracker.md`, and the corresponding worker prompt:

- provider profile
- model class
- concrete planned model, when known
- effort
- reasoning tier
- routing rationale

Use only these abstract model classes:

- `cheap-coder`
- `general-coder`
- `strong-coder`
- `frontier`
- `frontier-reviewer`

Do not put concrete provider model IDs in this reference.

## Routing Table

| story risk | reasoning tier | implementer class | implementer effort | reviewer class | reviewer effort |
|---|---|---|---|---|---|
| mechanical docs/config/test split, no cross-story contract risk | `light` | `cheap-coder` | `low` | `frontier-reviewer` | `medium` |
| default bounded implementation | `standard` | `general-coder` | `medium` | `frontier-reviewer` | `medium` |
| public API, shared shape, cross-file contract, safety boundary, or conformance harness | `elevated` | `strong-coder` | `high` | `frontier-reviewer` | `high` |
| exceptional architecture, security boundary, migration, or data-loss risk | `critical` | `frontier` | `high` or `xhigh` with rationale | `frontier-reviewer` | `high` |

Use `frontier-reviewer` as the reviewer class for every story unless the package is blocked for
planning repair.

## Routing Rationale

Write a concise rationale for each story that names the risk driver. Tie the rationale to the story's
observable delivery risk: mechanical scope, bounded implementation, public/shared contract,
safety/conformance boundary, architecture, security boundary, migration, or data-loss risk.

For `critical` stories, state why `frontier` is required. Use `xhigh` implementer effort only when
the story needs it, and state the reason.

## Stop Behavior

Treat `critical` as the ceiling. If a story appears to require more than `critical`, stop and report
the exact story as too risky or underspecified for delivery packaging. Require `$plan-epic` or
planning repair before continuing.

Do not invent a stronger tier. Do not split frozen ready scope inside this skill to make the package
fit the routing table.
