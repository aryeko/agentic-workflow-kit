# CLAUDE.md — Claude Code operating layer for kit-vnext

This file is the Claude Code operating layer. It extends `AGENTS.md`, which is the
canonical source for invariants, conventions, and the verify gate. When this file and
`AGENTS.md` appear to conflict, `AGENTS.md` wins — do not duplicate facts, only
reference them.

---

## Operating mode

- **Plan before code.** For any non-trivial change, produce a written plan first.
  Review it before writing implementation. Use Plan Mode (`shift+tab` twice) for
  structured planning.
- **TDD.** Write the test first (RED), implement to pass (GREEN), refactor (IMPROVE).
  Do not write implementation before the failing test exists. Target 90% minimum
  coverage; aim for 95%.
- **Delegate to sub-agents.** Use parallel sub-agents for independent work streams.
  Each sub-agent must have a clear scope, a hard tool/time budget, and a worktree
  verification step before any git write (see Worktree discipline below).
- **This file extends `AGENTS.md`.** Read `AGENTS.md` first for invariants, the
  Dependency Rule, the four seams, capability attestation, AD-12 isolation, event log,
  two authorities, evidence over prose, autonomy scope, and conventions.

---

## Worktree discipline

Non-trivial work happens in a worktree under `.worktrees/<name>`, never in the main
repo checkout. The main checkout is for reading only.

A sub-agent MUST verify its working directory is the correct worktree root before
executing any `git commit`, `git push`, or file write. Sub-agents have committed to
the main repo by mistake in the past. The verification step is not optional.

Verification pattern for sub-agents before any git write:

```
confirm: pwd starts with /Users/aryekogan/repos/workflow-kit/.worktrees/<name>
confirm: git rev-parse --show-toplevel matches the worktree root, not the main checkout
```

If either check fails, stop and report — do not proceed.

One consolidated PR per logical unit is the default. Split into multiple PRs only when
the changes are independently reversible and the split is explicitly requested.

---

## Invariants as hard guardrails

The invariants below are stated here for quick reference. `AGENTS.md` is the
canonical, detailed source.

**Dependency Rule — enforced by CI.** Edge -> Control plane -> Contracts; Drivers ->
Contracts; Foundation -> nothing above it. `pnpm deps` (dependency-cruiser) plus
TypeScript project references enforce this mechanically. A violation fails CI.

**Four seams.** All host/tool specifics live behind Agent, Execution Host, Forge, or
Work Source contracts. Do not couple the core to a concrete driver.

**Capability attestation.** Probe -> record `CapabilityAttestation` event -> gate.
Missing, stale, or negative attestation => capability absent, dependent power off.
Fail closed.

**AD-12 isolation.** Worker: code edits and local commits only, no Forge credentials.
Runner: push, PR, verification, merge. These roles are never merged.

**Event log.** Append-only. State and metrics are pure projections. Never mutate
shared state.

**Two authorities.** Task status = Work Source. Run activity = event log. Never merge
them.

**Evidence over prose.** Worker self-reports are hints. Gates require external,
verifiable evidence.

**v1.0.0 autonomy scope.** Manual and assisted modes only. Auto-approval deferred.

---

## The gate — never claim done without it

Run the full verify gate before declaring any change complete:

```
pnpm check
```

The gate runs: `format:check` -> `lint` -> `deps` -> `typecheck` -> `test:unit` ->
`test:int` -> `test:conf`. Each step must pass. See `AGENTS.md` for the full gate
description.

CI additionally runs `pnpm pack:dry-run` and a gated `smoke` job. If CI fails after a
local clean run, investigate — do not re-push without understanding the failure.

---

## What is frozen vs open

**Frozen (do not re-decide here):**

- The eight load-bearing invariants listed above. They come from the design corpus that
  will be repopulated into `docs/` in a later step.
- The package decomposition: which packages exist, where their boundaries are, and the
  Dependency-Rule edges they carry. This is design-owned. Do not invent packages.
- Core internals: the domain model, event types, gate sequencing, and seam contracts
  are design-owned. The full designs will land in `docs/` in a later step.

**Open (iterate here):**

- Tooling, CI configuration, and the verify gate composition.
- Test infrastructure in `tooling/` and `tests/infra/`.
- `docs/` content added by the design owners.
- `packages/` contents added by the design owners.

---

## Security

- No hardcoded secrets anywhere. Credentials only via environment variables or the
  Credentials seam's scoped injection mechanism.
- Validate at system boundaries; fail fast with clear messages.
- Redact credentials, tokens, and personally identifiable data in telemetry and logs.
- Before any commit, confirm: no secrets in diff, no new hardcoded values.
- If a security issue is found: stop, fix it, rotate any exposed secrets before
  proceeding.
