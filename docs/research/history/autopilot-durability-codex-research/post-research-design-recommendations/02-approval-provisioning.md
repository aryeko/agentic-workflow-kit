---
title: Approval and provisioning recommendations
status: post-research recommendation draft
last-reviewed: 2026-06-18
sources: [R3, R4, R11]
---

# Approval and provisioning

## Problem

The child was told to request approval for network or privileged setup, but no durable approver existed.
Under `approvalPolicy: never`, no request was raised. Under request-capable modes, the request could hang.
At the same time, broad `danger-full-access` is not a safe default because dependency installation can run
arbitrary lifecycle code and expose secrets.

## Recommendation

Build a workflow-kit-owned `ApprovalRelay` as a durable state machine:

1. catch protocol approval requests;
2. normalize them into a host-neutral request;
3. persist the request before deciding;
4. classify risk deterministically;
5. decide through policy, bounded auto review, or human;
6. answer live protocol requests only within a short window;
7. park long human-latency requests durably;
8. resume through a fresh owned turn with a scoped grant;
9. audit every decision and outcome.

Approval is not a long-lived socket prompt. Human-latency decisions must survive process death and parent
restart.

Sources: [R3](../research-reports/R3-approval-permission-relay.md),
[R4](../research-reports/R4-sandbox-dependency-supply-chain.md),
[R11](../research-reports/R11-config-policy-migration.md).

## Approval lifecycle

Recommended events:

- `approval-requested`;
- `approval-normalized`;
- `approval-classified`;
- `approval-pending`;
- `approval-decision-recorded`;
- `approval-live-response-sent`;
- `approval-parked`;
- `approval-resolved`;
- `approval-resume-started`;
- `approval-outcome`;
- `approval-expired`;
- `approval-denial-circuit-opened`.

If the request cannot be decided quickly, close the protocol request safely with decline/cancel/timed-out
semantics, persist `approval-parked`, and resume later through an owned child process or app-server turn.

## Risk ladder

| Tier | Examples | Default decision |
|---|---|---|
| Low | lockfile-bound install to declared registry hosts, read-only metadata | policy grant when configured |
| Medium | approved lifecycle scripts, private registry read, known external binary host | assisted/human unless policy opts in |
| High | secrets, broad egress, Docker/socket access, writes outside worktree, destructive ops, `danger-full-access` | human or deny |

Unknown classification is high risk by default.

## Dependency provisioning policy

Default child posture:

- workspace-write sandbox;
- no ambient network;
- no inherited broad secrets;
- no SSH agent or user package auth by default;
- only per-run cache/store paths are writable outside the worktree;
- dependency setup runs as child work, but grants are brokered by the parent/relay.

Low-risk dependency grant requires all of:

- declared package manager and committed lockfile;
- clean/frozen install command (`pnpm install --frozen-lockfile`, `npm ci`, equivalent);
- HTTPS to declared registry/CDN hosts only;
- no lockfile or manifest mutation;
- no secret injection;
- lifecycle scripts handled separately.

pnpm-specific baseline:

- prefer `pnpm fetch` plus offline install when feasible;
- preserve frozen lockfile behavior;
- require `allowBuilds` for build scripts;
- keep exotic dependencies and minimum-release-age policy explicit;
- avoid shared writable stores across untrusted runs.

npm-specific baseline:

- prefer `npm ci`;
- use script allowlists or `--ignore-scripts` where needed;
- keep Git dependencies and remote tarballs opt-in;
- require explicit approval for broad script execution.

## Config policy

vNext should use explicit policy blocks:

- `provisioning`;
- `approval`;
- `escalationPolicy`;
- `capabilities`.

Defaults should be safe:

- `approval.mode: assisted`;
- dependency-install auto-grant only for narrow lockfile/registry cases;
- lifecycle scripts escalate separately;
- `orchestratorDecideApprovals`, `unattendedRun`, `autoRecover`, `autoRelaunch`, and `autoMerge` off;
- per-run operator overrides have deterministic highest precedence and recorded provenance.

Existing `pr.merge.auto: true` should mean the repo permits merge when gates pass. It should not by
itself enable the vNext `autoMerge` capability.

## Degraded modes

| Situation | Behavior |
|---|---|
| Runtime cannot catch approvals | fail closed before approval-requiring launch |
| Runtime cannot preload scoped grant on resume | park as operator-required |
| Operator never answers | expire request, cancel/decline live request, block story with evidence |
| Process dies while parked | keep pending request if committed; resume through new owned turn after decision |
| No lockfile | no automatic install grant |
| Private registry token missing | park with minimum credential request |
| Egress enforcement unavailable | do not replace it with broad network; park |

## Validation spikes

- MCP elicitation happy path and no-handler regression.
- App-server command/network/file approval matrix.
- Human-latency park/resume across process death.
- Dependency install with registry-only egress and separate lifecycle script escalation.
- Secret redaction fixture for approval events.
- Policy table tests across mode, tier, policy, runtime capability, and outcome.

<!-- DOCS-NAV (generated — do not edit by hand) -->

---

**↑ Up:** [documentation home](../../../../README.md) · **← Prev:** [Runtime and control recommendations](./01-runtime-control.md) · **Next →:** [State and coordination recommendations](./03-state-coordination.md)

<!-- /DOCS-NAV -->
