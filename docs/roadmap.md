# Rebuild Roadmap

This file is a durable, high-level tracker for the kit-vnext v1.0.0 rebuild.
It records what step is in progress, who owns it, and what each step produces.
It is not a spec; design detail lives in the design corpus and domain docs.

## Branches

| Branch | Role |
|---|---|
| `design/autopilot-durability` | Design branch that produced the core spine, edge, domain designs, postmortems, and research now merged into `v-next`. |
| `v-next` | Integration base and future mainline. Cut from `main`; receives all rebuild work through PRs. |
| `main` | Legacy v0.7.0 frozen at tag `v0.7.0-legacy`. No active development. |

## Steps

| # | Step | Owner | Status |
|---|---|---|---|
| 1 | **Foundation infra** — cut `v-next` from `main`; wipe legacy artifacts; lay down monorepo plumbing, verify gate, four test lanes, zero-real-process guard, CI workflows, and operating docs. Package decomposition is design-owned and not part of this step. | infra | in progress |
| 2 | **Finish domain designs** — complete the core spine, control plane, edge, and driver contracts; adversarial review, approve, and freeze. Design owners also settle the package decomposition during this step. | design owners | in progress |
| 3 | **Merge designs into v-next** — PR the finished design branch into `v-next`, keeping only the design docs and the two postmortem directories. | — | done — PR #105 at `49d3151` |
| 4 | **Repopulate and refine docs** — reorganize the merged design corpus under `docs/design/`, move postmortems and research under `docs/history/`, and apply tightly scoped design/index updates needed for the new ground-truth tree. | — | done — this PR |
| 5 | **Implementation track** — add an implementation-tracking folder (stories, dependencies, requirements, parallelism map) and begin building packages behind the verify gate. | — | planned |

Update the Status column as steps complete.
