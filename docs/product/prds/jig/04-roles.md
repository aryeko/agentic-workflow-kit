← [Back to README](./README.md)

# Roles

## Personas

- **Developer / Owner** — the human who uses Jig to ship software. They own the product
  direction, design, and execution policy. They submit the execution plan, set the policy and
  work profile (starting from a preset, tuning from there), approve escalations, and review
  the event log. Their scarcest resource is judgment and attention; Jig's job is to make sure
  they are interrupted only when a real decision is on the line, and that their attention is
  spent on those decisions — not on managing process noise. Best fit: anyone with enough
  judgment to own product, design, and policy direction — solo engineers, small teams, leads,
  architects.

- **Agent Worker (Implementer)** — the AI agent that implements stories. It receives a
  well-scoped story, implements it (code edits, local commits), and produces evidence that
  the story's acceptance criteria are satisfied. It operates inside the authorization fence:
  sandboxed, no forge credentials, cannot widen its own permissions, cannot initiate pushes
  or merges. Multiple workers may run concurrently across independent stories in a plan,
  subject to the policy's concurrency ceiling.

- **Tool / Suite Integrator** — a developer building on top of Jig's observability surface.
  They consume the machine-readable event log to build tooling — a learning loop, an eval
  harness, a dashboard, a fix-forward scanner — without modifying Jig's core. Jig exposes
  stable, documented records and extensibility hooks (CFG-7) for this purpose.

*Note: the Runner (the Jig process itself, the privileged orchestrator) is not a human
persona — it is the system component that performs irreversible actions. It is named here to
clarify the worker/runner split, not because it is a user role.*

## Capability matrix

| Capability | Developer / Owner | Agent Worker | Tool / Suite Integrator |
|---|---|---|---|
| Set policy and work profile | **yes** | no | no |
| Select or customize a preset | **yes** | no | no |
| Submit an execution plan | **yes** | no | no |
| Start, pause, or stop a run | **yes** | no | no |
| Implement stories (code edits, local commits) | no | **yes** | no |
| Push branch, create PR, merge | no (runner only) | no | no |
| Widen permissions mid-run | no | no | no |
| Approve escalations | **yes** | no | no |
| Modify policy during a run | no (requires re-approval) | no | no |
| Modify protected files (CI, gates, policy) without re-approval | no | no | no |
| Read event log and run records | **yes** | read-only (own story events only — see FENCE-6) | **yes** |
| Build tooling on top of event log records | **yes** | no | **yes** |
| Register custom extensibility hooks | **yes** | no | **yes** |
| Invoke capability probe | no (runner only) | no | no |

---
Previous: [03-domain-model](./03-domain-model.md) · Next: [05-phases](./05-phases.md) · Up: [README](./README.md)

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [Jig PRD](./README.md) · **← Prev:** [Domain model](./03-domain-model.md) · **Next →:** [Phases](./05-phases.md)

<!-- /DOCS-NAV -->
