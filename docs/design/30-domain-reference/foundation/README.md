---
title: kit-vnext — foundation domain reference
status: high-level design
last-reviewed: "2026-06-19"
---

# Foundation domain reference

Foundation provides reusable substrate for SDK internals and providers.

## Domains

| Domain | Original ID | Owns |
|---|---|---|
| [Configuration and policy](configuration-and-policy/README.md) | fnd-01 | Config schema, resolution, provenance, policy. |
| [Storage and artifacts](storage-and-artifacts/README.md) | fnd-02 | Event-log persistence, leases, artifact store. |
| [Workspace and repository](workspace-and-repository/README.md) | fnd-03 | Local worktree lifecycle and local git evidence. |
| [Credentials and secrets](credentials-and-secrets/README.md) | fnd-04 | Scoped credentials, redaction, audit, egress policy. |

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [domain reference](../README.md) · **← Prev:** [Observability & Analysis - analysis contract](../core/observability-and-analysis/analysis-contract.md) · **Next →:** [Configuration & Policy](./configuration-and-policy/README.md)

**Children:** [Configuration & Policy](./configuration-and-policy/README.md) · [Storage & Artifacts](./storage-and-artifacts/README.md) · [Workspace & Repository](./workspace-and-repository/README.md) · [Credentials & Secrets](./credentials-and-secrets/README.md)

<!-- /DOCS-NAV -->
