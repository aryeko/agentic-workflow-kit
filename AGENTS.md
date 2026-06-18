# AGENTS.md — Contributor and agent contract for kit-vnext

This file is the authoritative reference for contributors and automated agents working
in this repository. It is self-contained: it does not link to design docs that are not
yet present. The full architecture and domain designs will be repopulated into `docs/`
in a later step.

---

## What kit-vnext is

kit-vnext is a deterministic control plane that delegates well-scoped work to agent
workers and lands it as reviewed, merged changes — safely, recoverably, and under
human supervision.

Key invariant: the control plane is deterministic code. There is no LLM "orchestrator".
Supervision, state, gating, and recovery are plain logic. Agents are workers rented
behind a bounded contract.

---

## The Dependency Rule

Dependencies flow in one direction only:

```
Edge -> Control plane -> Contracts
Drivers               -> Contracts
Everything            -> Foundation
Foundation            -> nothing above it
```

- Contracts never depend on the core.
- Nothing depends on a concrete driver.
- Foundation depends on nothing above it. Peer dependencies within the foundation layer
  are allowed.

This rule is PROVEN mechanically, not just reviewed:

- **`pnpm deps`** runs dependency-cruiser with `.dependency-cruiser.cjs`. Any import
  that violates the rule is a hard error.
- **TypeScript project references** enforce the same boundaries at the type level.
- A violation fails CI. It is not a review suggestion — it is a gate.

---

## Four provider seams

Everything host- or tool-specific lives behind one of four provider seams. Each seam
is a contract (TypeScript interface), a real driver (concrete implementation), and a
mock driver (used in the conformance-mock test lane). New host integrations add a
driver; they do not touch the core.

| Seam | Responsibility |
|------|---------------|
| Agent | Delegate bounded work to an agent worker |
| Execution Host | Spawn and manage execution environments |
| Forge | Source control operations (push, PR, merge) |
| Work Source | Read task definitions; report task status |

---

## Capability attestation (earn autonomy)

Autonomy is not assumed. Each driver is probed at runtime and the result recorded as a
`CapabilityAttestation` event in the run log. The control plane gates on fresh,
positive attestations before exercising a capability. Missing, stale, or negative
attestation => the capability is treated as absent and the dependent power stays off.
This is fail-closed behavior.

---

## AD-12 worker/runner credential isolation

The worker role and the runner role have strictly separated credentials and
responsibilities:

- **Worker**: code edits and local commits only. The worker NEVER holds Forge
  credentials. It cannot push, cannot open or update PRs, and cannot merge.
- **Runner**: owns push, PR create/update, verification, and merge. The runner
  exercises Forge credentials only after external verification gates are satisfied.

This isolation is a hard design constraint, not a configuration option.

---

## Event log as single source of truth

The run event log is append-only. State, metrics, and summaries are pure projections
(pure functions of the log). Nothing writes state by mutating a shared record; every
fact is derived from the log. This makes recovery, replay, and audit straightforward.

---

## Two authorities

Task status belongs to the Work Source. Run activity belongs to the event log. These
two authorities never overwrite each other. The control plane reads from both but does
not merge them into a single mutable record.

---

## Evidence over prose

A worker's self-report never satisfies a gate by itself. Gates require external,
verifiable evidence (e.g., CI status from the Forge seam, test results from the
Execution Host seam). A worker claiming success is a hint, not a proof.

---

## v1.0.0 autonomy scope

v1.0.0 supports manual and assisted modes only. Auto-approval and LLM-adjudicated
approval are explicitly deferred. The autonomy ceiling is human-in-the-loop.

---

## Package layout is design-owned

The package decomposition — which packages exist, where their boundaries are, and
which Dependency-Rule edges they carry — is decided by the design owners, not here.
The `packages/` directory is the pnpm workspace slot and is intentionally empty. Full
designs and the package decomposition will be added to `docs/` in a later step.

Do not invent packages or package boundaries outside of that process.

---

## Conventions

- No emojis anywhere: not in code, comments, commit messages, or docs.
- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`,
  `perf:`, `ci:`. Descriptive subject lines; no attribution footers.
- Focused files: 200-400 lines typical, 800 lines hard maximum. Extract utilities
  rather than growing files.
- Diagrams: Mermaid only, inline in Markdown. No external diagram formats.
- Immutability: never mutate objects or arrays; return new copies.
- No hardcoded secrets: credentials via environment variables or the Credentials seam's
  scoped injection only.
- Plan before code: open a plan, review it, then implement.
- TDD: write the test first (RED), implement to pass (GREEN), refactor (IMPROVE).
  Target 90% coverage minimum; aim for 95%.

---

## How to run the checks

Install once:

```
pnpm install
```

Full verify gate (required before every merge):

```
pnpm check
```

Steps run in order, fail-fast:

1. `pnpm format:check` — Biome format check
2. `pnpm lint` — Biome lint
3. `pnpm deps` — dependency-cruiser Dependency-Rule enforcement
4. `pnpm typecheck` — TypeScript `tsc -b` (all project references)
5. `pnpm test:unit` — unit lane (hermetic)
6. `pnpm test:int` — integration lane (hermetic)
7. `pnpm test:conf` — conformance-mock lane (hermetic)

CI additionally runs `pnpm pack:dry-run` and a gated `smoke` job
(`vitest run --project smoke-real`). The smoke lane is the only lane allowed real
processes and network; it is excluded from the local `pnpm check` inner loop.

Never claim a change is done without a clean `pnpm check` run. Evidence over prose.
