# AGENTS.md — Contributor and agent contract for kit-vnext

This is the canonical contract for anyone — human or agent — doing work in this
repository. It is deliberately lean: it states the rules that always apply and points to
where the detail lives. The authoritative design is the corpus under `docs/design/`. Read
the file that owns your task's subject; do not work from memory and do not duplicate the
corpus here. (README.md is for humans; this file is for the work.)

---

## What kit-vnext is

A deterministic control plane that delegates well-scoped work to agent workers and lands
it as reviewed, merged changes — safely, recoverably, and under human supervision. The
control plane is plain code; there is no LLM "orchestrator." Agents are workers rented
behind a bounded contract.

---

## Where the ground truth lives

The design corpus is the source of truth. Read the file that owns your task's subject:

| Need | Read |
|------|------|
| System shape, seams, layering | `docs/design/10-architecture/architecture.md` |
| What must be true (FR/NFR ids) | `docs/design/00-orientation/requirements.md` |
| A decision and its rationale (AD-* ids) | `docs/design/40-decisions/accepted-decisions.md` |
| Vocabulary | `docs/design/00-orientation/glossary.md` |
| How designs are written and scoped | `docs/design/00-orientation/conventions.md` |
| The 16 domains: index, layers, dependencies, build order | `docs/design/30-domain-reference/README.md` |
| A specific domain's mandate and design | `docs/design/30-domain-reference/<layer>/<id>/README.md` |
| Verify gate, test lanes, tooling, CI | `docs/engineering/` |
| Rebuild status and steps | `docs/roadmap.md` |
| Incident postmortems and research (context, not spec) | `docs/research/history/` |

---

## When you get a task, read this first

Pull only what the task touches — do not load the whole corpus.

- **Implement or change a domain** → its `README.md` (Mandate first, then design)
  and any flat sibling aspect files; confirm its layer and dependencies in
  `docs/design/30-domain-reference/README.md`.
- **Cross-domain, seam, or layering question** → `docs/design/10-architecture/architecture.md`.
- **"Why is it this way?"** → `docs/design/40-decisions/accepted-decisions.md` (AD-* records).
- **Author a new domain design** → copy `docs/design/_templates/domain-design-template.md`
  and follow `docs/design/00-orientation/conventions.md`.
- **Tooling, gate, or CI work** → `docs/engineering/`.
- If a task seems to need something outside `docs/design/`, stop and raise it — the design
  is meant to be self-contained (provider `evidence/` appendices are the only exception).

Use subagents for wide reads so the main session context stays lean.

---

## Non-negotiable invariants

One line each; the full treatment and rationale live in `docs/design/`. Do not re-decide
these.

1. **Dependency Rule** — Edge → Control plane → Contracts; Drivers → Contracts;
   everything → Foundation; Foundation depends on nothing above it. Enforced by CI
   (`pnpm deps` + TypeScript project references); a violation fails the build.
2. **Four seams** — all host/tool specifics live behind the Agent, Execution Host, Forge,
   or Work Source contracts. Never couple the core to a concrete driver.
3. **Capability attestation (earn autonomy)** — probe → record a `CapabilityAttestation`
   event → gate on it. Missing, stale, or negative ⇒ capability absent, dependent power
   off. Fail closed.
4. **AD-12 worker/runner isolation** — worker: code edits and local commits only, no
   Forge credentials. Runner: push, PR, verification, merge. Never merge the roles.
5. **Event log is the single source of truth** — append-only; state and metrics are pure
   projections. Never mutate shared state.
6. **Two authorities** — task status belongs to the Work Source; run activity belongs to
   the event log. Never merge them.
7. **Evidence over prose** — a worker's self-report is a hint, not proof. Gates require
   external, verifiable evidence.
8. **v1.0.0 autonomy scope** — manual and assisted modes only; auto / LLM-adjudicated
   approval is deferred (AD-14).

See `docs/design/10-architecture/architecture.md` and `docs/design/40-decisions/accepted-decisions.md` for the detail.

---

## Branch model and workflow

- **`v-next`** is the integration base and future mainline. Branch from it; open PRs
  **into** it. It is protected — every change needs a PR and a green required **`check`**
  status. Do not push to `v-next` directly.
- **`main`** is frozen legacy v0.7.0 at tag `v0.7.0-legacy`. Do not modify it or the tag.
- **`design/autopilot-durability`** is the design branch that produced the corpus (now
  merged); historical reference only.
- Do non-trivial work in a worktree under `.worktrees/<name>` cut from `v-next`; the main
  checkout is for reading. Verify you are in the worktree before any git write.
- One consolidated PR per logical unit. Conventional commit subjects
  (`feat:`/`fix:`/`refactor:`/`docs:`/`test:`/`chore:`/`perf:`/`ci:`); no attribution
  footers; no emojis.

---

## The verify gate — never claim done without it

```
pnpm install   # once
pnpm check     # before every commit and PR
```

`pnpm check` runs fail-fast: `format:check` → `lint` → `deps` → `typecheck` →
`test:unit` → `test:int` → `test:conf`. CI additionally runs `pnpm pack:dry-run` and a
gated `smoke` job (the only lane allowed real processes and network; excluded from the
local loop). Full detail: `docs/engineering/check-gate.md`. Show the gate output as
evidence; do not assert success.

---

## Conventions

- **No emojis** anywhere — code, comments, commits, or docs.
- **Focused files** — 200–400 lines typical, 800 hard maximum. Extract rather than grow.
- **Immutability** — never mutate objects or arrays; return new copies.
- **Diagrams** — Mermaid only, inline in Markdown.
- **Plan before code; TDD** — failing test first (RED), implement (GREEN), refactor;
  target 90% coverage minimum, aim for 95%.
- **Security** — no hardcoded secrets; credentials only via environment variables or the
  Credentials seam's scoped injection. Redact credentials, tokens, and PII in logs and
  telemetry. Validate at system boundaries; fail fast. If you find an exposed secret,
  stop and rotate it before continuing.

---

## What is design-owned (do not invent)

The package decomposition (`packages/` is intentionally empty until design owners fill
it), the domain model, event types, gate sequencing, and seam contracts are decided in
`docs/design/`. Tooling, the verify-gate composition, test infrastructure (`tooling/`,
`tests/`), and CI are open to iterate.
