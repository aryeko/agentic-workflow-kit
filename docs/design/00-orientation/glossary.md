---
title: kit-vnext — glossary
status: high-level design (scaffold)
last-reviewed: 2026-06-18
---

# Glossary

Shared vocabulary. Use these terms exactly; do not introduce synonyms.

| Term | Meaning |
|---|---|
| **Run** | One execution of the delivery loop for one task: provision → delegate → verify → merge/settle. Has a durable event log. |
| **Task** | A unit of work provided by the Work Source (a story/issue). Carries a spec (inline text and/or links to a PRD/design) and a lifecycle status. |
| **Track** | A grouping of related tasks (epic/workstream). Generic in the contract; a driver maps it to its native concept. |
| **Control plane** | The deterministic core: run state, gating, adjudication, supervision, completion/merge, recovery, analysis. No LLM in the loop. |
| **Operator** | The human. A first-class participant: approves, hands off, overrides, inspects. Not a fallback. |
| **Agent / worker** | The LLM agent that implements a task inside the workspace. Rented behind the Agent seam; never the supervisor. |
| **Driver** | A concrete adapter implementing a provider contract (e.g. Codex agent driver, GitHub forge driver, Markdown work-source driver). |
| **Provider / seam** | One of the four host-neutral contracts the core depends on: **Agent**, **Execution Host**, **Forge**, **Work Source**. |
| **Forge** | The collaboration provider: PR / CI / review / merge (GitHub first). |
| **Work Source** | The provider of tasks, grouping, eligibility, claim/release, and **task status authority**. Not a document store. Markdown first. |
| **Execution Host** | The provider of *where and how* a worker and runner-owned commands run: spawn, containment, verify. Local first; remote later. |
| **Capability** | An autonomous power (e.g. `auto-merge`, `auto-recover`, `unattended-run`, `orchestrator-decide`) unlocked only when its guarantees hold. |
| **Capability attestation** | A driver guarantee that is **probed and recorded** (with scope, expiry, freshness), not merely declared; the core gates on fresh, positive attestations. |
| **Gate** | An evidence check the control plane applies before acting (completion gate, merge gate, capability gate). |
| **Event log** | The append-only, single source of truth for a run. The only authored run state. |
| **Projection** | A derived read-only view (`state` / `summary` / `metrics` / `launch`) recomputed from the event log; never authored directly. |
| **Writer model** | The single-leased-writer + monotonic-sequence + fencing discipline that makes the append-only log safe under crashes and stale writers. |
| **Supervision / liveness** | Determining whether a worker is really making progress, derived from real worker events (not parent polling). |
| **Approval relay** | Catching a worker's escalation request, classifying + adjudicating it, and answering with the tightest scoped grant. |
| **Park / resume** | Persisting a pending approval as durable state so it survives human latency and process death, then resuming the owned session with the grant. |
| **Scoped grant** | The tightest escalation that suffices — never blanket full access. `PolicyGrantScope` is the policy-intent layer owned by fnd-01 and core-03 (`per-command`, `per-command-prefix`, `per-host`, or `session`). It is distinct from provider-enforcement grant lifetime (`request`, `turn`, or `session`) plus `ScopedGrantKind`, owned by prov-01; the two compose. |
| **Containment** | The OS-level mechanism that makes a local worker's whole process tree killable and reapable (process group / cgroup / Job Object). |
| **Ownership class** | How the kit relates to a worker process: `owned`, `owned-remote`, or `observe-only`. Drives which capabilities are reachable. Distinct from core-01 session `linkRole` (`primary`, `recovery`, or `observer`); do not conflate them. |
| **Recovery classifier** | The pure function that maps run evidence to a named recovery state and a safe action class. |
| **Earn autonomy** | The principle that every autonomous capability is locked behind proven guarantees; default is supervised. |
| **Charter** | The chief-architect-owned brief for a domain: responsibility, scope, requirements, dependencies, required reading, deliverable, DoD. |

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [orientation](./README.md) · **← Prev:** [requirements](./requirements.md) · **Next →:** [reading guide](./reading-guide.md)

<!-- /DOCS-NAV -->
