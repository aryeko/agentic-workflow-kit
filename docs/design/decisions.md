---
title: kit-vnext — architecture decisions
status: high-level design (scaffold)
last-reviewed: 2026-06-18
---

# Architecture decisions

The load-bearing decisions for vNext, in ADR form. Each is **Accepted**. Domain designs must comply;
a domain that needs to revisit a decision raises it here first.

---

### AD-1 — Greenfield; legacy frozen (with adoption diagnostics)
**Decision.** vNext is a new version line. Prior code/docs are read-only history; nothing is migrated,
derived from, or transformed. **However**, vNext must **detect** legacy/incompatible config and
artifacts and **refuse to run** (fail closed) with explicit adoption guidance; read-only analysis of
legacy artifacts is optional. **Consequence.** No backward-compat constraints on the design, and no
silent mishandling of old inputs — a diagnostic, not a migration. (Owner: fnd-01.)

### AD-2 — Platform: TypeScript/Node core + native containment helper (local only)
**Decision.** Core, contracts, drivers, and the operator surface are TS/Node. The native helper
(Rust/Go) provides **local process containment only** — it is **not** the remote-exec mechanism.
**Consequence.** Best MCP ecosystem and fastest iteration for the orchestration logic; the native
concern is isolated inside the Local Execution Host driver. Remote execution is the Execution Host
seam (AD-13), not the helper protocol.

### AD-3 — Deterministic control plane; agents are workers
**Decision.** Supervision, state, gating, and recovery are deterministic code. No LLM "orchestrator"
supervises a run. Agents are rented behind the Agent seam for bounded judgment tasks. **Consequence.**
The control plane is verifiable and replayable (NFR-DET); the fragile parent-agent pattern is gone.

### AD-4 — Human is first-class; autonomy is earned
**Decision.** The operator is a first-class participant. Every autonomous power is a capability locked
behind explicit, evidence-checked guarantees; default posture is supervised. **Consequence.**
Safe-by-default; optimized for trustworthy hand-offs, not for removing the human.

### AD-5 — Four provider seams + capability **attestation**
**Decision.** Host/tool specifics live behind four contracts — **Agent**, **Forge**, **Work Source**,
**Execution Host** — and each driver's capabilities are **attested** (probed and recorded), not merely
declared. The core gates on attestations. **Consequence.** New providers are added without core
changes (NFR-EXT); a capability that cannot be proven is treated as absent. See AD-14 and
[architecture.md](architecture.md) §3.

### AD-6 — Event log is the single source of truth
**Decision.** An append-only run event log is the only authored run state. `state`/`summary`/
`metrics`/`launch` are projections — pure functions of the log. **Consequence.** State divergence and
linkage clobber are structurally impossible; recovery/reconciliation are appended events.

### AD-7 — Evidence over prose
**Decision.** Completion and merge are decided from independently gathered evidence + explicit policy.
A worker's self-report is a hint. **Consequence.** A claim with no corroborating evidence is unverified
and blocks nothing forward.

### AD-8 — Work Source = task management + status authority
**Decision.** The Work Source provides work items, grouping (tracks), eligibility, claim/release, and
is the **status authority** for tasks. It is **not** a document store, supports **multiple tracks**,
and a kit instance operates on **one project/repo** in v1 (a task carries a `target/project` field so
multi-project is a later routing layer). **Consequence.** Task status and run activity are two separate
authorities; markdown is the first driver.

### AD-9 — Local-first; remote via the Execution Host seam
**Decision.** v1 runs locally; remote execution (cloud agents, remote machines) is a future
**Execution Host** driver, accommodated by the seam, not by changing the core. **Consequence.**
Coordination stays lean for local single-host; no distributed machinery is built until a remote target
is real.

### AD-10 — Day-one providers + mocks + conformance
**Decision.** Agent = Codex + mock; Forge = GitHub + mock; Work Source = Markdown + mock; Execution
Host = Local + mock. Every contract is designed against one real provider **and** its mock, and every
driver must pass a **provider conformance suite** (schema probes, real-driver smoke tests, incident
replays, adversarial mocks). **Consequence.** Seams are provably satisfiable, not fantasy interfaces;
"the core runs on mocks" is real confidence, not false.

### AD-11 — Diagrams in Mermaid, in-markdown
**Decision.** All diagrams are Mermaid fenced blocks. **Consequence.** Versionable, diffable,
extendable; no binary assets.

### AD-12 — Worker / runner action boundary
**Decision.** The worker does **code edits + local commits** only. The **runner** owns **push, PR
create/update, verification, and merge** (via the Forge and Execution Host seams). **Consequence.**
The worker never holds Forge credentials (credential isolation — a malicious dependency or the worker
cannot exfiltrate a push token), and the runner controls the exact head SHA all evidence binds to.
This keeps the child the sole *implementer* while the runner owns the credentialed, irreversible
boundary — consistent with AD-3/AD-4.

### AD-13 — Execution Host is a seam (Local v1 / Remote later)
**Decision.** A fourth seam owns **where and how processes run**: spawning + containment of the worker
and **runner-owned command execution** (the verifier). Local driver in v1 (uses the AD-2 helper);
remote drivers later. **Consequence.** Containment has a clear home; the verifier is runner-owned (not
dependent on the Agent's honesty); remote-exec has a real abstraction rather than an overloaded helper.

### AD-14 — v1 autonomy scope: manual/assisted only
**Decision.** v1 ships approval modes **manual** and **assisted** only. **`auto` / orchestrator-decide
(LLM adjudication) is deferred** until judgment-as-recorded-input and its bounds are proven.
**Consequence.** Removes the determinism tension for v1: every v1 control decision is a pure function
of recorded evidence; non-deterministic inputs (human decisions, and later LLM judgments) enter
**only as recorded events**, never as replayable logic.
