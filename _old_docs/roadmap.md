# Rebuild Roadmap

This is the durable, high-level roadmap for the kit-vnext v1.0.0 rebuild. It is
not a spec; authoritative design detail lives under `docs/design/`, and
implementation work is tracked under `docs/implementation/`.

## Branches

| Branch | Role |
| --- | --- |
| `v-next` | Integration base and future mainline for all rebuild work. |
| `main` | Frozen legacy v0.7.0 line. No active development. |
| `design/autopilot-durability` | Historical design branch whose durable corpus has been merged into `v-next`. |

## Steps

| # | Step | Owner | Status |
| --- | --- | --- | --- |
| 1 | **Foundation infra** - cut `v-next`, remove legacy runtime surfaces, lay down monorepo plumbing, verify gate, Vitest lanes, zero-real-process guard, CI, and operating docs. Package decomposition stayed design-owned. | infra | done - foundation scaffold `ed11930`; required `check` job name `2f77b1d` |
| 2 | **Design corpus** - complete and merge the core spine, edge, domain designs, postmortems, and research corpus. | design owners | done - PR #105 at `49d3151` |
| 3 | **Docs tree reorganization** - organize the merged corpus under `docs/design/` and move postmortems/research under `docs/history/`. | docs | done - PR #106 at `b98cf60` |
| 4 | **Wave 0 truth and substrate** - align governance docs, design truth, package map, foundation policy, and dependency/testing substrate before package implementation. | wave 0 | in progress - branch `impl/wave-0-truth-and-substrate`; charters under `docs/implementation/waves/wave-0-truth-and-substrate/` |
| 5 | **Package implementation** - add packages behind the design-owned package map and verify gate. | implementation | planned - starts after Wave 0 substrate is merged |

Update this file only with durable branch or commit evidence, not per-PR working
notes.
