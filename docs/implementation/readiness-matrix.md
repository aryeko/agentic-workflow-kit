---
title: "Implementation readiness matrix"
status: active
last-reviewed: 2026-06-19
---

# Implementation readiness matrix

This is the tracking axis that sits beside design frontmatter. In the design corpus,
`status: approved` means design-approved: the contract, API, workflow, or domain design has been
reviewed as a design. It does not mean a package exists, a driver is safe to rely on, a conformance
suite passes, or runtime capability attestations exist.

Capability-dependent powers stay off until executable evidence records fresh positive attestations.
Provider gaps below are tracked readiness state, not defects in the design-approved contracts.

## Readiness terms

| Term | Meaning |
|---|---|
| `yes` | Axis-specific evidence exists: frontmatter/catalog approval for `design-approved` per the [domain catalog](../design/domains/README.md); executable cited evidence for package, conformance, smoke, probe, and runtime-attestation axes. |
| `partial` | Design-stage evidence, fixtures, schema probes, or primitive probes exist, but executable implementation evidence is incomplete. |
| `no` | No package, conformance pass, real smoke, negative probe, or runtime attestation is currently claimed. |
| `n/a` | The axis does not apply to that domain or driver. |
| `not claimed` | This initial tracker does not have enough scoped evidence to assert the axis. Treat as not ready. |

## Shared substrate readiness

| Component | package implemented | conformance/self-test | open gaps | runtime attestation |
|---|---:|---:|---|---:|
| Provider conformance kit | yes | yes | Real-driver smoke slots are registered but intentionally skipped in the mock lane until driver waves. Evidence: `pnpm exec vitest run --project conformance-mock packages/conformance-kit/tests/conformance-kit.conformance.test.ts --coverage '--coverage.include=packages/conformance-kit/src/**/*.ts' --coverage.thresholds.lines=90 --coverage.thresholds.branches=90` passed with 100% lines and 94.02% branches; depcruise passed for `packages/conformance-kit`. | n/a |

## Domain readiness

| Domain | design-approved | package implemented | mock conformance | real-driver smoke | negative/egress probes | open capability gaps | runtime attestation |
|---|---:|---:|---:|---:|---:|---|---:|
| edge-01 Operator & Entry Surface | yes | no | n/a | n/a | n/a | Implementation package and executable evidence pending. | no |
| core-01 Run Lifecycle & Event State | yes | no | n/a | n/a | n/a | Implementation package and executable evidence pending. | no |
| core-02 Capability & Safety | yes | no | n/a | n/a | n/a | Capability gates need runtime attestation inputs from providers. | no |
| core-03 Approval & Escalation | yes | no | n/a | n/a | n/a | Implementation package and executable evidence pending. | no |
| core-04 Supervision & Liveness | yes | no | n/a | n/a | n/a | Depends on Agent and Host structured observations and kill evidence. | no |
| core-05 Completion, Verification & Merge | yes | no | n/a | n/a | n/a | Depends on runner-owned verify and Forge evidence. | no |
| core-06 Recovery, Reconciliation & Coordination | yes | no | n/a | n/a | n/a | Depends on Host kill/prove-empty and provider recovery signals. | no |
| core-07 Observability & Analysis | yes | no | n/a | n/a | n/a | Implementation package and executable evidence pending. | no |
| prov-01 Agent Execution | yes | no | partial | no | n/a | Live approval relay, approval persistence, owned resume, structured tool exit, Guardian stability, and host parentage remain open. | no |
| prov-02 Forge / Collaboration | yes | no | partial | no | n/a | GitHub write-side smoke for push, PR/comment writes, update branch, queue, merge, and optional thread resolution remains open. | no |
| prov-03 Work Source | yes | no | partial | no | n/a | Markdown and mock drivers are fixture-only; executable claim, status write, dependency, and race conformance remain open. | no |
| prov-04 Execution Host | yes | no | partial | partial | no | Real Local driver, AD-2 helper conformance, full termination ladder, structured host observations, and live egress negative probes remain open. | no |
| fnd-01 Configuration & Policy | yes | no | n/a | n/a | n/a | Implementation package and executable evidence pending. | no |
| fnd-02 Storage & Artifacts | yes | no | n/a | n/a | n/a | Implementation package and executable evidence pending. | no |
| fnd-03 Workspace & Repository | yes | no | n/a | n/a | n/a | Implementation package and executable evidence pending. | no |
| fnd-04 Credentials & Secrets | yes | no | n/a | n/a | n/a | Credential refs and egress-policy configuration remain tracked outside this item. | no |

## Driver readiness

| Provider domain | Driver | design-approved | package implemented | mock conformance | real-driver smoke | negative/egress probes | open capability gaps | runtime attestation |
|---|---|---:|---:|---:|---:|---:|---|---:|
| prov-01 Agent Execution | Codex Agent driver | yes | no | n/a | no | n/a | Live approval relay, approval persistence, owned resume, structured tool exit, Guardian stability, and host parentage are not executable-proven. | no |
| prov-01 Agent Execution | Mock Agent driver | yes | no | partial | n/a | n/a | Mock scenarios are designed, but executable mock conformance is not implemented. | no |
| prov-02 Forge / Collaboration | GitHub Forge driver | yes | no | n/a | no | n/a | Disposable-remote write smoke for push, PR/comment writes, update branch, enqueue, merge, and thread-resolution behavior remains open. | no |
| prov-02 Forge / Collaboration | Mock Forge driver | yes | no | partial | n/a | n/a | Mock conformance snapshot exists; executable mock driver package and suite remain pending. | no |
| prov-03 Work Source | Markdown Work Source driver | yes | no | n/a | no | n/a | Fixture evidence exists, but executable parse, lock, claim, release, status write, dependency, and race tests remain pending. | no |
| prov-03 Work Source | Mock Work Source driver | yes | no | partial | n/a | n/a | Mock fixture exists; executable mock driver package and conformance suite remain pending. | no |
| prov-04 Execution Host | Local Execution Host driver | yes | no | n/a | partial | no | Primitive local command and process-group probes exist; implemented AD-2 helper, full prove-empty conformance, and live egress confinement remain pending. | no |
| prov-04 Execution Host | Mock Host driver | yes | no | partial | n/a | partial | Mock snapshot covers egress positive and adversarial cases; executable mock driver package and conformance suite remain pending. | no |

Remote Execution Host drivers are deferred future drivers. They are not day-one readiness targets and
must get their own rows before any remote-host capability is claimed.

## Update rule

Later waves update this file when they land axis-specific evidence. `design-approved` may be `yes`
when domain or driver design frontmatter records `status: approved`. Package, conformance, smoke,
negative-probe, and runtime-attestation axes may move to `yes` only when the package exists and the
relevant command has run successfully against the named driver and exact scope. Schema snapshots,
design evidence, fixtures, prose, or a worker self-report may move an implementation axis to
`partial`; they cannot move it to implementation-ready.
