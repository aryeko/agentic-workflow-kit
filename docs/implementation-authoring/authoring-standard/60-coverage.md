---
title: "Coverage — exactly-once ownership"
status: draft
last-reviewed: "2026-06-22"
---

# Coverage

> **Audience** — architect (authoring) · coverage reviewer (grading).
> **Job** — ensure every `Story Group Signal` is owned **exactly once** across the epic set (and, once a
> story DAG freezes, exactly once across its stories). The domain charters are the coverage oracle.

The unit of coverage is the **`Story Group Signal`, not the domain.** Domains deliberately span epics, so
"is the domain covered?" is trivially yes and proves nothing. Each signal is the line item accounted for
exactly once. Coverage runs both ways: **completeness** (top-down — every signal `covered` by exactly
one owner or `deferred`; neither = a gap surfaced loudly) and **traceability** (bottom-up — every output
and AC traces up to a signal, then to design; an item with no source signal is scope creep, dropped or
pushed back to design).

> **Coverage scope presupposes runtime substrate.** A statement/branch coverage lane is meaningful only
> when the measured pathset emits runtime substrate (an exported value / enum / `as const` / function); a
> type-only producer's lane is satisfied vacuously (`0/0`→100%) and proves nothing. The proof-substrate
> invariant and the `as const` catalog convention live in
> [engineering/testing-policy.md](../../engineering/testing-policy.md#proof-substrate); the authoring-time
> gate is the **Proof-substrate match** box in
> [50-story-contract.md](50-story-contract.md#gate-4--authoring-ready).

## Disposition vocabulary

| Disposition | Meaning |
|---|---|
| `covered` | claimed by exactly one epic, and after the story DAG freezes, owned by exactly one story id. |
| `deferred(<why>, <until>)` | **no epic owns this signal in v1** — intentionally out of scope, accounted-for not a gap. Use only when *no* epic claims it. |
| `split(<parts>)` | one signal genuinely divided across stories *within one epic*, each part named so it stays exactly-once at the part level. A story-layer disposition, not an epic-layer one. |

## Partition is not deferral

This is the rule two independent readers got wrong: they thought a signal owned by another epic needed a
`deferred` row in every non-owning epic. When two careful readers re-derive the same error, the rule is
under-specified, not the readers.

When a domain's signals are owned by **different epics**, that is a normal cross-epic **partition**. Each
epic's `Per-domain expectations` table lists **only the signals it owns**. Signals owned by other epics
are **simply absent** here and tracked in the rollup.

- A partitioned signal is **not `deferred`** — `deferred` means *no* epic owns it; some epic does.
- A partitioned signal is **not `split`** — `split` divides one signal across stories *inside* an epic,
  not the same domain's different signals across epics.
- **Do not add `deferred` rows for signals another epic owns.** A non-owning epic stays silent about
  them. Adding such rows is the exact error to avoid.

## Worked example

`prov-01` has 5 signals (4 SDK-port → Epic 2, 1 driver → Epic 6); `edge-01` has 7 (1 mock-smoke → Epic 3,
5 production + 1 true deferral → Epic 7). Each epic lists only its own:

| Signal | Owner | Epic's table shows | Reconciles to |
|---|---|---|---|
| `prov-01` 4 port/mock | Epic 2 | 4 `covered`; driver **absent** (not `deferred`) | 4 (E2) + 1 (E6) = 5 |
| `prov-01` 1 driver | Epic 6 | 1 `covered` | — |
| `edge-01` 1 mock-smoke | Epic 3 | 1 `covered` | 1 (E3) + 5 + 1 deferred (E7) = 7 |
| `edge-01` 5 prod + 1 deferral | Epic 7 | 5 `covered` + 1 `deferred(v1 excludes external triggers, post-v1)` | — |

A signal `covered` in two epics' tables is a **DOUBLE**; a charter signal in no table and not deferred is
a **GAP**. Both are findings.

## Where it is recorded

The **per-epic `Per-domain expectations` tables are the oracle** — they list only the signals that epic
owns (with owning story, or a `deferred` row for a no-epic signal), keeping the check next to the work so
each epic self-verifies. The **coverage rollup** is the global view that reconciles counts to the
charters with no signal unclaimed and none double-owned. It lives at
[`../../implementation/coverage.md`](../../implementation/coverage.md) — the instance folder, *outside*
this corpus. It pairs with this rule but stays there.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Authoring standard — Pillar 1](./README.md) · **← Prev:** [Principles — the universal bar](./10-principles.md) · **Next →:** [Domain charter template](./_templates/domain-charter.md)

<!-- /DOCS-NAV -->
