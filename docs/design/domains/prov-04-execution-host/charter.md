---
title: "Execution Host — charter"
id: "prov-04"
layer: "providers"
status: "charter: ready"
last-reviewed: 2026-06-18
---

# Execution Host — charter

**Purpose.** The seam for **where and how processes run** — spawning and containing the worker, and
running **runner-owned commands** (the verifier) — against a workspace. Local driver in v1; remote
drivers later. This is the clean home for containment and for the remote-exec future.

## Responsibilities (in scope)
- The host-neutral **Execution Host contract**: spawn a worker process against a prepared workspace;
  **contain** it (own the process tree); signal/terminate the whole tree and reap it; and run
  **runner-owned commands** (the verify gate) capturing command/argv/cwd/exit/signal/output + digests.
- **Capability attestation**: `canKill`, `containmentStrength`, `emitsStructuredToolExit`, and
  **egress confinement proven with negative probes** (a disallowed host is provably blocked),
  recorded with driver version + platform + freshness.
- The **Local driver** (the AD-2 native containment helper: process group/session, cgroup/systemd or
  Job Object where available; reap; prove-empty) and a **mock host**.

## Out of scope
- The agent protocol (prov-01 drives a worker that *runs on* a host).
- Local git (fnd-03) and remote/credentialed collaboration (prov-02).

## Requirements owned
FR-3 (run the worker), FR-5 (guaranteed termination), FR-6 (runner-owned verify), NFR-EXT, NFR-TEST,
NFR-SEC (egress attestation), NFR-OPS.

## Dependencies (Dependency Rule)
- Depends on: fnd-03 (the workspace it runs in), fnd-04 (scoped creds for runner-owned commands).
  Implements the Execution Host contract.
- Must NOT: depend on the control plane.

## Required reading
Standard set + [fnd-03](../fnd-03-workspace-and-repository/charter.md),
[fnd-04](../fnd-04-credentials-and-secrets/charter.md), AD-2/AD-13 in
[decisions.md](../../decisions.md), and the conformance/evidence rules in
[conventions.md](../../conventions.md).

## Deliverable
`design.md` defining: the contract + attestations; the Local driver's termination ladder
(signal → grace → SIGKILL → reap → prove-empty); the runner-owned command/verify capture; the egress
attestation incl. negative probes; the mock; remote-host considerations (deferred, but the contract
must not bake in locality).

## Definition of done (domain-specific)
- Termination reaps the whole tree and proves the containment empty (tested).
- Egress confinement is attested with negative probes; `containmentStrength` attested honestly.
- Verify capture is runner-owned (never the Agent's self-report). Contract satisfiable by Local + mock.

## Open questions
- Kernel-tree vs process-group containment as the floor for autonomy; native language (Rust vs Go);
  the remote-host protocol shape (deferred).
