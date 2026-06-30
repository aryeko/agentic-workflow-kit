---
title: Jig product feature-gap analysis (design → product)
status: draft
last-reviewed: 2026-06-30
---

# Jig Product Feature-Gap Analysis

What the engineering design describes that the rebuilt product layer
(`docs/product/jig.md` + supporting products) does **not** yet surface — and, for each gap,
whether to productize it and why.

This feeds **Pass 2** of the product-layer rebuild (alongside use cases and diagrams). It is
an input to planning, not a change to the product layer itself.

## Method

Four parallel readers swept the design corpus over non-overlapping slices and classified every
designed capability as COVERED / PARTIAL / MISSING against the current product baseline (the
five guarantees and their IDs in `docs/product/jig.md`):

- Architecture (`docs/design/10-architecture/*`)
- Core domains (`docs/design/30-domain-reference/core/*`)
- Edge / foundation / providers (`docs/design/30-domain-reference/{edge,foundation,providers}/*`)
- Requirements + SDK/packaging + decisions (`docs/design/00-orientation/requirements.md`,
  `20-sdk-and-packaging/*`, `40-decisions/*`)

Source caveat: the design docs read for this analysis live in a separate worktree
(`.worktrees/epic6-codex-provider-design-block/docs/design`) and are **reference, not ground
truth**. Their decomposition and naming (e.g. "foundation", "edge", bundling storage with
artifacts, config with policy) are **not binding** — this analysis judges *functionality*, not
the design's grouping.

## Verdict

The rebuilt product layer captured the **guarantees** (what is true for the user) but missed
three whole categories the guarantees imply yet never name:

1. **How you operate Jig** — the control surface (start/preview/inspect/watch/stop/explain/
   approve/hand off) and the attention model. Absent.
2. **How you run Jig** — the access surfaces (CLI, MCP server, embeddable SDK). Absent.
3. **Several trust dimensions** — liveness/supervision, security depth (redaction, egress
   confinement, credential isolation), and driver-trust (conformance, manifest approval). Named
   only partially or not at all.

Gaps **G1–G5** below are genuine product gaps, not polish. **G6–G12** are real enrichments.
**G13** and the mechanism list are deliberately excluded. The recommendation column is
**Include** (productize), **Light** (one promise/line, not a section), **Boundary** (state as a
non-goal / not-yet), or **Exclude** (design owns it).

---

## G1 — Operating surface (how you drive a run)

**Functionality.** A stable command surface: `start`, `preview`, `inspect`, `wait`/watch,
`stop`, `explain` ("why did / didn't X happen"), `override-field`, `handoff`, `ack`/snooze.
Each is one typed, audited action.
**Designed in.** `edge/operator-surface/command-surface-and-envelopes.md`, `README.md`.
**Today.** MISSING — `jig.md` describes guarantees but never how a human interacts with a run.

**Recommendation: Include (top priority).** New "Operating Jig" section in `jig.md`.
**Why.** This is the most basic product gap: a reader finishes the page knowing what Jig
*promises* but not what they *do* with it. A product is the verbs as much as the guarantees.
The `explain` verb in particular ("why is this blocked / why did it merge") is a genuine
differentiator — an attributable answer grounded in recorded facts, not a log to interpret.
Hold altitude: name the verbs and what each gives the owner; leave envelope schemas,
idempotency keys, and OS-user identity capture to design (see G13).

## G2 — Attention model (your cockpit)

**Functionality.** Every parked/blocked/stale/overdue condition becomes a typed notice with a
kind, a severity, and the **actions available right now**; the operator triages an inbox
rather than reading a log.
**Designed in.** `edge/operator-surface/attention-explainability-and-triggers.md`.
**Today.** MISSING.

**Recommendation: Include.** Part of the G1 "Operating Jig" section, reinforced under ⑤ SEE.
**Why.** "Long-running work is transparent" (a SEE promise) is hollow without the human-facing
shape of that transparency: *what needs me, how urgent, what can I do about it.* This is the
difference between a tool that notifies "something went wrong" and one that hands you a triaged
decision queue — directly on the owner's scarcest resource, attention.

## G3 — Access surfaces (CLI / MCP / SDK)

**Functionality.** Three first-class ways to run/integrate Jig: a terminal **CLI**, an **MCP
server** an agent can drive as a tool, and an embeddable **SDK/library** (`createWorkflowKit`).
**Designed in.** `20-sdk-and-packaging/cli-and-mcp-wrappers.md`, `sdk-boundary.md`,
`package-target.md`.
**Today.** MISSING — neither README nor `jig.md` says how you actually get or invoke Jig.

**Recommendation: Include.** A "How you run it" line in the suite README + a line in `jig.md`.
**Why.** "What do I get and how do I use it" is table-stakes for a product page. The SDK path
especially matters: it is how a team embeds Jig in their own runner or UI rather than being
forced through the CLI — a real adoption surface that "four swappable seams" (STACK) does not
imply. External triggers and remote hosting are related but deferred — see Boundaries.

## G4 — Supervision & liveness (watching the run, not just the result)

**Functionality.** Jig detects a *stuck or silently dead* worker — not just a clean crash —
via progress/idle/no-heartbeat/approval-SLA signals, and escalates instead of waiting forever.
**Designed in.** `core/supervision-and-liveness/*`, `10-architecture/observability-and-analysis.md`.
**Today.** MISSING — RESUME covers recovery *after* a failure; nothing covers noticing a hang.

**Recommendation: Include.** A new facet under ③ "Never lose work; resume safely."
**Why.** This is a distinct trust dimension, not a sub-case of recovery. The product currently
implies Jig reacts when a run *fails*; it never promises Jig notices when a run *hangs*. For an
overnight, unattended run that distinction is the whole value — a hung agent that burns the
night silently is exactly the failure mode the product claims to prevent. Surface the promise
("Jig knows the difference between thinking, stuck, and dead"); leave the timer taxonomy and
liveness-state enum to design.

## G5 — Security depth (redaction, egress confinement, credential isolation)

**Functionality.** Three named promises: (a) secrets never land in records, logs, artifacts, or
exports (source-side redaction); (b) the agent cannot phone home — egress is confined and
**proven with negative probes**, not self-claimed; (c) the worker never holds forge
credentials — only the runner does.
**Designed in.** `foundation/credentials-and-secrets/*`, `providers/execution-host/README.md`,
`requirements.md` (FR-12, NFR-SEC).
**Today.** PARTIAL — FENCE-3 states (c); redaction and egress confinement are absent.

**Recommendation: Include.** A security facet under ① Control & Trust.
**Why.** These are the highest-leverage trust promises for any security-conscious adopter, and
two of the three are simply missing. They also reinforce the product's core thesis — *proof,
not self-report* — at the security layer: "the agent can't exfiltrate, and we don't take its
word for it." Keep the promises; leave `RedactionSet` tokens and negative-probe internals to
design.

## G6 — Driver trust (conformance, manifest approval, honest containment)

**Functionality.** Bring your own driver and **prove** it against a conformance suite
(including adversarial probes); approve **what a provider package may do** (runtimes, egress,
credentials) by manifest, re-approving on change; the host reports its **actual** containment
strength, and strong-isolation powers unlock only when it is genuinely strong enough.
**Designed in.** `20-sdk-and-packaging/testkit-and-conformance.md`, `provider-manifest.md`,
`provider-authorization.md`, `providers/execution-host/README.md`.
**Today.** MISSING.

**Recommendation: Include.** Under ④ "Runs against your stack" / EARN.
**Why.** STACK today says "capabilities are attested." That covers a driver's *runtime*
capabilities but not the *supply-chain* trust around adopting a driver at all — exactly the
concern a user has when wiring a non-default provider. Conformance ("prove it before you trust
it") and manifest approval ("nothing escalates silently") extend "attested, not assumed" to the
driver itself, and honest containment strength is strong honest-edge material.

## G7 — Merge-path concreteness

**Functionality.** "Done" and "merged" are **separate milestones** with separate proof; a
blocked run surfaces as a **real PR with the failure reasons** in a runner comment; run status
is posted to the PR; Jig is compatible with **merge queues** and reads **branch-protection**
rules; tool exit codes are **observed by the runner**, not taken from the agent's word.
**Designed in.** `core/completion-and-merge/*`, `providers/forge-collaboration/README.md`,
`10-architecture/evidence-gates-and-merge.md`.
**Today.** PARTIAL — MERGE states evidence-gated landing but not these user-visible specifics.

**Recommendation: Include (selective).** Enrich ① MERGE and ⑤ SEE; ideal use-case fodder.
**Why.** MERGE/SEE are abstract today; these make them tangible and, crucially, show the work
appearing **in the user's normal GitHub flow** (a PR with reasons they can act on) rather than
only inside Jig's surface. The completion-vs-merge split also answers a real owner question —
"is the work done?" is not the same as "is the PR mergeable right now?" Include the
user-visible facts; leave capability flags and outcome-state enums to design.

## G8 — Concurrency safety (why parallel is safe)

**Functionality.** Each run works in its own isolated git worktree; task claims are race-safe;
duplicate launches of the same task are prevented across processes.
**Designed in.** `foundation/workspace-and-repository/README.md`,
`providers/work-source/README.md`, `10-architecture/launch-coordination.md`.
**Today.** PARTIAL — ISO promises fault isolation but not workspace/launch isolation.

**Recommendation: Light.** One or two lines under ③ ISO / the Tracks concept.
**Why.** The product promises parallel independent tracks and per-story isolation; this is the
*reason* that is safe — runs can't corrupt each other's working tree, and you won't get two
runs racing the same task or duplicate PRs. Worth naming as the trust behind the parallelism
claim; the lease-epoch mechanics stay in design.

## G9 — Run export (shareable, tamper-evident audit record)

**Functionality.** Export a completed run as a write-once, redacted-by-default manifest for
audit/compliance/forensics outside Jig.
**Designed in.** `20-sdk-and-packaging/storage-port-types.md`,
`foundation/storage-and-artifacts/README.md`.
**Today.** MISSING.

**Recommendation: Light.** One line under ⑤ SEE.
**Why.** "The records are the evidence" (SEE) implies you can take that evidence with you. For
regulated or audit-heavy teams, a portable tamper-evident export is a concrete, differentiating
payoff of the evidence model — cheap to promise, high signal.

## G10 — Setup freshness (skip work that's already done)

**Functionality.** Declare a setup command (e.g. `npm install`) with a freshness detector; Jig
skips it when the worktree is already fresh and runs it only when stale.
**Designed in.** `foundation/workspace-and-repository/README.md`.
**Today.** MISSING.

**Recommendation: Light.** One line under ② CFG.
**Why.** A concrete efficiency the owner feels immediately on repeated runs, and it fits CFG's
"you own the configuration" story. Small, but the kind of practical detail that makes a product
page feel real rather than aspirational.

## G11 — Task-dependency ordering

**Functionality.** Tasks declare dependencies; a task stays ineligible until its prerequisites
are complete, so work never starts out of order.
**Designed in.** `providers/work-source/README.md` (`supportsDependencies`), `requirements.md`
(FR-8).
**Today.** PARTIAL — ISO-1 mentions dependency-aware *isolation* (blocking downstream on a
failure) but not dependency-aware *eligibility* (not starting before prerequisites finish).

**Recommendation: Light.** Extend ISO-1's wording.
**Why.** It closes a correctness gap a reader would assume is handled: in a real plan, starting
a dependent story before its prerequisite lands produces conflicts or wrong work. Naming both
directions (don't-start-early and halt-downstream-on-failure) makes the dependency story whole.

## G12 — Autonomy modes & predictable escalation

**Functionality.** A human-in-loop dial — **manual** (you decide every escalation) and
**assisted** (low-risk auto-granted, high-risk to you); **auto/LLM-adjudicated is deferred**.
Escalations are classified by a deterministic risk rule, and the operator chooses the
**narrowest grant scope** that satisfies a request.
**Designed in.** `core/approval-and-escalation/decision-model.md`,
`human-control-and-approvals.md`, `requirements.md` / `accepted-decisions.md` (AD-14).
**Today.** PARTIAL — DOOR covers escalation and scoped grants; the manual/assisted *modes* and
the determinism of classification are not surfaced.

**Recommendation: Light.** Under ② CFG / ① DOOR; the deferral goes to Boundaries.
**Why.** "How much does it ask me?" is a first-order question for anyone evaluating delegation,
and "every escalation is a human in v1 — no LLM decides for you" is a procurement-relevant trust
boundary worth stating plainly. Determinism ("you can predict which actions auto-grant") turns
DOOR from a promise into something testable for the owner.

## G13 — Storage / network-filesystem degradation

**Functionality.** Jig probes that its storage can do what it needs (atomic rename, fsync,
lease CAS) before running, and fails closed on unreliable network filesystems.
**Designed in.** `foundation/storage-and-artifacts/README.md`.
**Today.** MISSING.

**Recommendation: Light → honest-edge line only.** One sentence in a ③ honest edge.
**Why.** Real but niche; it belongs as a fail-closed honesty note ("Jig checks its storage is
safe and stops if it isn't"), not a feature with its own billing. Most owners never hit it; the
ones on NFS will value the honesty.

---

## Boundaries — state as non-goal / not-yet (currently missing)

The design marks these explicitly out-of-scope or deferred. The product layer should name them
so it is honest about its edges; their absence today reads as oversight rather than decision.

| Boundary | Status | Why state it |
|---|---|---|
| Auto / LLM-adjudicated approvals | Deferred (AD-14) | Sets the trust ceiling: a human decides every escalation today. |
| Remote execution host | Seam-ready, driver deferred | Portability promise is real but local-first now; don't over-claim. |
| External triggers (webhooks/schedulers) | Deferred | A run is operator-initiated today; integrations come later. |
| Hosted multi-tenant service | Out of scope (v1) | Jig is a tool you run, not a service you buy — relevant to positioning. |
| Legacy-config migration | Out of scope; fail-closed adoption check instead | Jig refuses unknown config with guidance rather than silently coping. |

**Recommendation: Include** as a short "What Jig isn't (yet)" subsection under Product
Boundaries. **Why.** Honest non-goals build more trust than silent omission, and they prevent
the product page from implying capabilities the design deliberately deferred.

## Excluded as design mechanism (filtered, not missed)

These surfaced in the sweep but are the "how," not the "what." They stay in `docs/design/`; the
product-visible *promises* they enable are already covered by SEE/RESUME/MERGE.

Writer-epoch fencing · projection / replay-engine internals · telemetry-topic taxonomy ·
terminal-epoch reuse · the 12-state lifecycle enum · changed-file classification categories ·
post-merge outcome-state enum · content-addressed artifact store / `ScratchArtifactRef` ·
session-linkage monotonicity · idempotency keys · OS-user identity capture · per-field config
provenance records.

## How this feeds Pass 2

Pass 2 of the product-layer rebuild should fold in **G1–G7** as real content (G1–G2 as a new
"Operating Jig" section; G3 across README + `jig.md`; G4 into ③; G5–G6 into ① / ④; G7 into MERGE
/ SEE and a use case), add **G8–G12** as light promises in their home guarantees, treat **G13**
as an honest-edge line, and add the **Boundaries** subsection. The mechanism list stays out.
Each addition holds product altitude: name the owner-visible outcome and the decision it
supports, never the protocol behind it.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [agentic-workflow-kit — documentation home](../README.md) · **← Prev:** [PR #167 authoring hardening note](./2026-06-26-pr-167-authoring-hardening-note.md) · **Next →:** [01 — Product Layer Read (R01-PRODUCT-LAYER-READ)](./2026-06-30-jig-product-layer-rebuild/01-product-layer-read.md)

<!-- /DOCS-NAV -->
