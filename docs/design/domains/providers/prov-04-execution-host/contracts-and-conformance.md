---
title: "Execution Host - contracts and conformance"
status: approved
last-reviewed: 2026-06-18
---

# Contracts and conformance

This file holds the typed contract details and conformance targets for
`docs/design/domains/providers/prov-04-execution-host/README.md`. It is split out because the type catalog
and driver conformance matrix are cohesive detail.

## Contract types

```ts
type HostCapability = "canKill" | "containmentStrength" | "emitsStructuredToolExit" | "egress-confinement";
type ContainmentStrength = "none" | "process-group" | "kernel-tree" | "job-object";
type CommandKind = "repo-setup" | "verify" | "diagnostic";
type HostFailureReason =
  | "host-capability-unattested" | "workspace-mount-unavailable" | "workspace-cwd-outside-mount"
  | "credential-injection-rejected" | "egress-confinement-unattested" | "worker-spawn-failed"
  | "host-observation-incomplete" | "termination-unproven"
  | "runner-command-capture-incomplete" | "credential-destroy-unconfirmed";

interface WorkspaceAttachment {
  kind: "local-worktree" | "workspace-mount"; leaseId: string; runId: string; repoId: string;
  branchName: string; worktreePath?: string; mountRef?: string;
}
interface HostWorkspaceHandle {
  handleId: string; workspace: WorkspaceAttachment; cwdRoot: string; driverId: string; attachedAt: string;
}
interface HostInjectionContext {
  operationId: string; party: CredentialParty; credentialRefIds: string[]; bindings: InjectionBinding[];
  egressPolicy: EgressPolicy; redactionSet: RedactionSet; requiredAuditEvent: CredentialUsePlanned;
  scopeDigest: string; attestationEventIds: string[]; expiresAt: string;
}
interface WorkerLaunch {
  agentDriverId: string; executableRef: string; argv: string[];
  environmentMode: "closed"; stdio: "pipe"; protocolHint?: string;
}
interface SpawnWorkerRequest {
  runId: string; operationId: string; party: "worker"; workspace: HostWorkspaceHandle; cwd: string;
  launch: WorkerLaunch; injection: HostInjectionContext; timeoutSeconds: number;
}
interface HostCommandRequest {
  runId: string; operationId: string; party: CredentialParty; kind: CommandKind;
  workspace: HostWorkspaceHandle; argv: string[]; cwd: string; injection: HostInjectionContext;
  timeoutSeconds: number;
}
interface CommandResult {
  operationId: string; commandDigest: string; cwd: string; exitCode?: number; signal?: string;
  // fnd-02 ArtifactRef.id values; resolve via ArtifactStore.resolve(id).
  stdoutRef?: string; stderrRef?: string; outputDigest: string; redactionApplied: boolean;
  startedAt: string; finishedAt: string;
}
interface WorkerHandle {
  handleId: string; runId: string; operationId: string; workspaceHandleId: string;
  ownershipClass: "owned" | "owned-remote" | "observe-only"; containmentRef: string; startedAt: string;
}

type HostObservation =
  | {
      type: "output"; handleId: string; stream: "stdout" | "stderr";
      // fnd-02 ArtifactRef.id; resolve via ArtifactStore.resolve(id).
      outputRef: string; digest: string; redactionApplied: true; at: string;
    }
  | { type: "structured-tool-exit"; handleId: string; tool: string; exitCode: number; payloadRef?: string; digest: string; at: string }
  | { type: "process-exit"; handleId: string; exitCode?: number; signal?: string; at: string }
  | { type: "host-failure"; handleId?: string; failure: HostFailure; at: string };

interface TerminationPolicy { initialSignal: string; graceSeconds: number; forceKill: boolean; proveEmptyTimeoutSeconds: number }
interface TerminationProof {
  signalSent: boolean; graceObserved: boolean; forceKillSent: boolean; reaped: boolean;
  containmentEmpty: boolean; evidenceRef: string; checkedAt: string;
}
interface TerminationResult { handleId: string; terminalExitCode?: number; terminalSignal?: string; proof: TerminationProof }
interface HostReleaseResult {
  workspaceHandleId: string; released: boolean; credentialMaterialDestroyed: boolean; evidenceRef: string; at: string;
}
interface HostFailure { reason: HostFailureReason; message: string; retryable: boolean; evidenceRef?: string; at: string }
interface HostProbeScope {
  driverId: string; driverVersion: string; platform: string; freshnessKey: string; capabilities: HostCapability[];
  workspaceKind?: WorkspaceAttachment["kind"]; egressPolicy?: EgressPolicy; at: string;
}
interface CapabilityAttestation {
  capability: HostCapability; probeMethod: string; result: "positive" | "negative"; evidenceRef: string;
  scope: string; expiry: string; driverVersion: string; platform: string; freshnessKey: string; at: string;
  details?: { containmentStrength?: ContainmentStrength; negativeProbeResults?: NegativeProbe[] };
}

interface ExecutionHost {
  probeCapabilities(scope: HostProbeScope): CapabilityAttestation[];
  attachWorkspace(workspace: WorkspaceAttachment): HostWorkspaceHandle | HostFailure;
  spawnWorker(request: SpawnWorkerRequest): WorkerHandle | HostFailure;
  observeWorker(handle: WorkerHandle): AsyncIterable<HostObservation>;
  terminateWorker(handle: WorkerHandle, policy: TerminationPolicy): TerminationResult;
  runCommand(request: HostCommandRequest): CommandResult | HostFailure;
  releaseWorkspace(handle: HostWorkspaceHandle): HostReleaseResult;
}
```

`HostInjectionContext` is the host-side projection of the `fnd-04` `InjectionPlan`. It preserves
party, credential refs, bindings, egress policy, redaction set, and required audit event, and adds
attestation-binding fields through `scopeDigest`, `attestationEventIds`, and `expiresAt`.
`spawnWorker` and `runCommand` must reject requests whose `injection.party` differs from `party`,
whose `egressPolicy.audience` differs from `party`, whose `operationId` differs from the request, or
whose attestations do not match the egress policy.

The fnd-04 public types used here are `InjectionBinding`, `EgressPolicy`, `RedactionSet`,
`CredentialParty`, `CredentialUsePlanned`, and `NegativeProbe`, defined in
`../../foundation/fnd-04-credentials-and-secrets/contracts-and-events.md`.

## Capability set

| Capability | Positive evidence | Negative / absent evidence |
|---|---|---|
| `canKill` | Signal, grace, force-kill when needed, reap, and prove-empty all recorded. | Any missing step returns `termination-unproven`. |
| `containmentStrength` | Driver reports actual class: `none`, `process-group`, `kernel-tree`, or `job-object`. | Unknown class is treated as absent capability. |
| `emitsStructuredToolExit` | Host preserves structured tool-exit envelopes when emitted. | Missing or malformed envelopes become ordinary output, not gate evidence. |
| `egress-confinement` | Policy-scoped negative probes prove disallowed hosts are blocked. | Missing, stale, wrong-scope, or allowed negative probe returns `egress-confinement-unattested`. |

`emitsStructuredToolExit` is this domain's Host capability, distinct from prov-01's Agent capability
with the same name. Consumers qualify attestations by provider through core-02
`AttestationRef.provider`.

## Conformance targets

Local driver conformance:

- Runs a command in an attached local worktree and captures argv, cwd, exit, signal, output refs, and
  output digest.
- Starts a worker under the AD-2 helper, observes output and terminal status, and exposes only host
  observations to Supervision.
- Executes the termination ladder: signal, grace, force-kill, reap, prove-empty.
- Applies worker-vs-runner injection plans without resolving credentials and redacts captured output
  before persistence.
- Attests egress only when negative probes prove configured disallowed hosts are blocked for the
  policy scope, platform, driver version, and freshness key.

Mock driver conformance:

- Implements the same interfaces with deterministic scripted outputs.
- Can emit positive and negative attestations for every capability.
- Can omit, delay, or lie about output, exits, liveness, egress, redaction, and termination so the
  Control plane and Capability & Safety gates prove fail-closed behavior.
