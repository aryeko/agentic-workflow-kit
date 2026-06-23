# Model Routing

Use this reference to assign story routing for the future execution run. Routing is abstract until
`orchestrated-delivery` binds runtime facts.

## Required Fields

Record these fields in `plan.md`, `tracker.md`, and the corresponding worker prompts:

- source story id;
- source `AC-n` ids covered by the package element;
- provider profile;
- model class;
- effort;
- suggested-tier floor from the DAG;
- reasoning tier selected for delivery;
- routing rationale.

Do not record provider-specific runtime model IDs, aliases, or version strings. The execution stage
selects those from current provider availability.

## Provider Profiles

Use profile labels that describe the intended capability lane, not a provider product:

- `cost-efficient-code`
- `default-code`
- `high-capability-code`
- `frontier-code`
- `high-capability-review`

Use `high-capability-review` for reviewer prompts unless the package is blocked.

## Model Classes

Use only these abstract model classes:

- `cheap-coder`
- `general-coder`
- `strong-coder`
- `frontier`
- `frontier-reviewer`

## Routing Table

| story risk | reasoning tier | implementer profile/class | implementer effort | reviewer profile/class | reviewer effort |
|---|---|---|---|---|---|
| mechanical docs, config, or test split with no cross-story contract risk | `light` | `cost-efficient-code` / `cheap-coder` | `low` | `high-capability-review` / `frontier-reviewer` | `medium` |
| default bounded implementation | `standard` | `default-code` / `general-coder` | `medium` | `high-capability-review` / `frontier-reviewer` | `medium` |
| public API, shared shape, cross-file contract, safety boundary, or conformance harness | `elevated` | `high-capability-code` / `strong-coder` | `high` | `high-capability-review` / `frontier-reviewer` | `high` |
| exceptional architecture, security boundary, migration, or data-loss risk | `critical` | `frontier-code` / `frontier` | `high` or `xhigh` with rationale | `high-capability-review` / `frontier-reviewer` | `high` |

The selected reasoning tier must be greater than or equal to the DAG's suggested-tier floor. Carry
the floor unchanged; do not lower, reinterpret, or delete it.

## Rationale

Write a short rationale that names the source story id, the relevant `AC-n` ids, and the risk driver:
mechanical scope, bounded implementation, public/shared contract, safety boundary, conformance
boundary, architecture, security boundary, migration, or data-loss risk.

For `critical`, state why `frontier` is needed. Use `xhigh` implementer effort only when the ready
story's risk justifies it.

## Stop Behavior

Treat `critical` as the ceiling. If a ready story appears to require more than `critical`, or if its
risk cannot be understood from the DAG and contract without invention, stop and route the exact
story back to `$plan-epic`.

Do not invent a stronger tier. Do not split or rewrite frozen scope to make the package easier to
route.
