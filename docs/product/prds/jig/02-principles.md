← [Back to README](./README.md)

# Principles

*Operating tenets that constrain every decision in this PRD and downstream in the technical
design. When two requirements appear to conflict, these principles break the tie.*

- **P1 — Enforce vs. guide (the three-tier line).** The control cluster (fence, earned
  trust, anti-gaming, doorbell, merge-on-evidence) is the one place Jig enforces rather than
  guides. Everything else is either user-enforced controls or product guidance. This line must
  never erode: a feature request that would weaken a system-enforced floor belongs in the
  user-enforced tier or is declined.

- **P2 — Evidence over prose.** A worker's self-report is never proof. Every gate requires
  external, independently verifiable evidence. Observability and gates share one source of
  truth: the same records that gate a decision are the records the user inspects afterward.
  There is no separate audit log that can drift out of agreement with what actually governed
  the run.

- **P3 — Policy, not posture.** How aggressively to gate — from throughput-leaning (gate
  lightly, scan after) to prevention-leaning (gate and prove before merge) — is a declarative
  policy choice, not a fixed product stance. Jig executes the configured policy faithfully;
  it does not impose a stance. The configurable spectrum is the product.

- **P4 — Fail closed.** When Jig cannot classify a request's risk level, cannot verify a
  capability, or cannot safely continue from a checkpoint, the default is "no" or "park and
  surface to a human" — never "proceed and hope." A silent partial progress is worse than a
  structured stop.

- **P5 — Computed actual, not configured actual.** The user sets intent through policy
  (ceiling) and work profile (realization). Jig derives what actually runs from those inputs
  plus the plan's current dependency state. The user never hand-configures the live
  concurrency number or task queue — that would undermine consistency and safety guarantees.

- **P6 — Seams are security boundaries.** Credentials and authority do not cross seam
  boundaries. The worker never holds forge credentials or push authority. Only the runner
  performs irreversible actions (push, PR creation, merge), on the worker's behalf, behind
  the configured gates. This is not a best practice — it is an architectural invariant.

---
Previous: [01-context](./01-context.md) · Next: [03-domain-model](./03-domain-model.md) · Up: [README](./README.md)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Jig PRD](./README.md) · **← Prev:** [Context](./01-context.md) · **Next →:** [Domain model](./03-domain-model.md)

<!-- /DOCS-NAV -->
