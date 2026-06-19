---
title: "w0-2 — Governance & doc truth — implementation charter"
id: "w0-2"
wave: 0
layer: "governance"
status: "item: ready"
spec: "docs/reviews/2026-06-19-current-branch-repo-review.md (§1, §3)"
---

# w0-2 — Governance & doc truth

**Purpose.** Bring root/governance docs and GitHub automation in line with the kit-vnext rebuild, so
neither human contributors nor Codex workers are misdirected by stale legacy instructions.

## Scope

- Rewrite `README.md`, `CONTRIBUTING.md`, `SECURITY.md` for kit-vnext. Drop legacy surfaces (`skills/`,
  `references/`, `presets/`, `packages/orchestrator/`, changesets, `main` release flow, `0.5.x`
  support). `docs/design/` is authoritative; `packages/` fills in per the W0/w0-3 package map.
- GitHub automation: Dependabot `target-branch: v-next`; issue/PR templates point at `v-next` (or
  branch-neutral) docs; the PR template describes the real 7-step gate and drops obsolete mirror
  checklist items.
- Refresh `docs/roadmap.md` to current reality (no "in progress" steps that are done; replace
  "done — this PR" durable-wording with stable commit/branch references).
- Make `docs/foundation/*` match the tracked tree: the zero-process-guard doc must describe the actual
  `vi.mock` + `vi.stubGlobal` mechanism and its real coverage; reconcile `pnpm-workspace.yaml`
  (currently `packages/*` only) with any doc claiming `tooling/`+`tests/` are workspaces.

## Out of scope

Any design-corpus edits (that's w0-1); any code; changing the verify gate's behavior (gate composition
changes belong to w0-3).

## Requirements owned

Documentation truthfulness; the safe-to-read-by-worker guarantee.

## Required reading

The [repo-review report](../../../../reviews/2026-06-19-current-branch-repo-review.md) (§1, §3);
`AGENTS.md`; current root governance files; `docs/foundation/*`.

## Deliverable

Updated governance docs + GitHub templates/automation + roadmap + foundation docs that match the
tracked tree.

## Definition of done

- *Spec compliance:* no tracked governance doc references a removed legacy surface; the PR template
  matches the real gate; the roadmap matches branch reality.
- *Quality bar:* `rg` for legacy tokens (`orchestrator`, `changesets`, `0.5.x`, `skills/`) returns only
  intentional historical mentions; Dependabot/issue/PR templates valid; `pnpm check` green.

## Boundaries

Docs/automation only. Do not change gate behavior here. If a doc fix implies a real tooling change,
note it for w0-3 rather than doing it here.
