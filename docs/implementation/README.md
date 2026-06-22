---
title: kit-vnext - implementation contract
status: draft
last-reviewed: "2026-06-21"
---

# Implementation contract

This directory defines the implementation contract for building kit-vnext from the approved design
corpus: what must be built, in what dependency order, and what evidence proves each item.

It does not define the execution process. Operational prompts, review-loop mechanics, PR batching,
commit policy, and session orchestration are deliberately outside this folder.

## Relationship to other docs

| Directory | Owns |
|---|---|
| [`../design/`](../design/) | Normative product, architecture, package, domain, and decision contracts. |
| [`../engineering/`](../engineering/) | Verification policy, check gate, dependency enforcement, and test lanes. |
| `./` | Implementation slicing, story contracts, and readiness evidence. |

When this directory conflicts with `../design/`, the design corpus wins. A story contract must be a
checkable subset of the design. If an implementation story needs a requirement that is missing from
design, the design must be amended before the story is dispatch-ready.

## Status — re-derivation in progress

The implementation plan is being **re-derived from scratch** against the now-frozen, layered
[`../design/`](../design/) corpus. The durable methodology and derived artifacts are kept here:

- [`work-item-authoring-guide.md`](work-item-authoring-guide.md) - how to write falsifiable story
  contracts (the standard every epic charter and story must meet).
- [`domain-dag.md`](domain-dag.md) - the domain-level dependency picture used to derive the epic DAG.
- [`epic-dag.md`](epic-dag.md) - the milestone-level epic DAG used to derive charters and stories.
- [`domains/`](domains/README.md) - domain implementation charters, grouped by design layer.
- [`epics/`](epics/README.md) - epic charter bundles, story DAG placeholders, and future story
  contracts.
- [`coverage.md`](coverage.md) - the global coverage rollup that proves every domain signal is
  accounted for across the epic set.

The remaining derived planning artifacts — epic charters, per-story contracts, package rollout, and
the readiness matrix — are intentionally authored from the frozen design using the authoring guide
(domain DAG -> epic DAG -> story contracts -> readiness matrix). The prior, pre-restructure versions
remain recoverable from git history.

Agent provider needs/requirements and the Codex provider research that informed the frozen design live
as dormant provenance under [`../research/codex-agent-provider/`](../research/codex-agent-provider/);
the normative Agent provider contract is owned by the
[design corpus](../design/30-domain-reference/providers/agent-execution/README.md).

## Planning answers locked for re-derivation

The first implementation plan starts from these v1 answers:

- Dependency-install auto-grants are explicit opt-in, not default-on.
- Missing or moved leased worktrees are tombstoned; replacement requires an explicit recovery or new
  run path.
- Environment variables are the only v1 secret-material source. Other secret managers are deferred
  adapters.
- Worker egress to public Forge hosts is default-deny unless a story grants read-only egress with an
  attested egress policy digest.
- Strong kill and containment proof is not required for the first simple CLI or supervised execution
  slice. It is required before unattended autonomy or kill-dependent recovery is enabled.
- No Go or Rust native helper is part of the initial plan. The Local provider may add one later behind
  the Execution Host seam if Node cannot prove the needed containment capability.
- Start with a simple vertical slice: `sdk` + `testkit` mocks/in-memory ports + a thin `cli`, then add
  concrete providers incrementally. Markdown comes before Local, GitHub, and Codex.

## Story contract standard

Every implementation story must define the shared contract a builder and any later verifier can grade
without private interpretation:

- normative design references;
- spec-surface manifest of required interfaces, events, DTOs, and failure tokens;
- falsifiable acceptance criteria;
- failure and degraded outcome table;
- required test lanes and commands;
- evidence pack expectations;
- explicit boundaries and STOP conditions.

Story contracts constrain DONE, not HOW. They should not dictate internal file layout, algorithms, or
session mechanics unless the design corpus itself makes that part of the normative surface. The full
standard is in [`work-item-authoring-guide.md`](work-item-authoring-guide.md).

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../README.md) · **← Prev:** [implementation status note](../design/IMPLEMENTATION_STATUS_NOTE.md) · **Next →:** [work item authoring guide](./work-item-authoring-guide.md)

**Children:** [work item authoring guide](./work-item-authoring-guide.md) · [domain dependency DAG](./domain-dag.md) · [epic dependency DAG](./epic-dag.md) · [domain implementation charters](./domains/README.md) · [epic charters](./epics/README.md) · [implementation coverage rollup](./coverage.md)

<!-- /DOCS-NAV -->
