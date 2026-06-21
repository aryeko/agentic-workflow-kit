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

## Status — clean slate, pending re-derivation

The implementation plan is being **re-derived from scratch** against the now-frozen, layered
[`../design/`](../design/) corpus. Only the durable methodology is kept here today:

- [`work-item-authoring-guide.md`](work-item-authoring-guide.md) - how to write falsifiable story
  contracts (the standard every frontier charter and story must meet).

The derived planning artifacts — the domain dependency DAG, frontier charters, per-story contracts,
package rollout, and the readiness matrix — are intentionally **not present**. They are outputs of the
re-derivation, not inputs to it, and will be authored here from the frozen design using the authoring
guide (DAG → frontier charters → story contracts → readiness matrix). The prior, pre-restructure
versions remain recoverable from git history.

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

**Children:** [work item authoring guide](./work-item-authoring-guide.md)

<!-- /DOCS-NAV -->
