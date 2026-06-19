import type { ArtifactRef as FoundationArtifactRef } from '@kit-vnext/foundation-fnd-02';
import type {
  CredentialParty,
  CredentialUsePlanned,
  EgressPolicy,
  InjectionBinding,
  RedactionSet,
} from '@kit-vnext/foundation-fnd-04';

export type ArtifactRef = FoundationArtifactRef;

export type HostCapability = 'canKill' | 'containmentStrength' | 'emitsStructuredToolExit' | 'egress-confinement';

export type ContainmentStrength = 'none' | 'process-group' | 'kernel-tree' | 'job-object';

export type CommandKind = 'repo-setup' | 'verify' | 'diagnostic';

export type HostFailureReason =
  | 'host-capability-unattested'
  | 'workspace-mount-unavailable'
  | 'workspace-cwd-outside-mount'
  | 'credential-injection-rejected'
  | 'egress-confinement-unattested'
  | 'worker-spawn-failed'
  | 'host-observation-incomplete'
  | 'termination-unproven'
  | 'runner-command-capture-incomplete'
  | 'credential-destroy-unconfirmed';

export interface WorkspaceAttachment {
  readonly kind: 'local-worktree' | 'workspace-mount';
  readonly leaseId: string;
  readonly runId: string;
  readonly repoId: string;
  readonly branchName: string;
  readonly worktreePath?: string;
  readonly mountRef?: string;
  readonly cwd?: string;
}

export interface HostWorkspaceHandle {
  readonly handleId: string;
  readonly workspace: WorkspaceAttachment;
  readonly cwdRoot: string;
  readonly driverId: string;
  readonly attachedAt: string;
}

export interface HostInjectionContext {
  readonly operationId: string;
  readonly party: CredentialParty;
  readonly credentialRefIds: readonly string[];
  readonly bindings: readonly InjectionBinding[];
  readonly egressPolicy: EgressPolicy;
  readonly redactionSet: RedactionSet;
  readonly requiredAuditEvent: CredentialUsePlanned;
  readonly scopeDigest: string;
  readonly attestationEventIds: readonly string[];
  readonly expiresAt: string;
}

export interface WorkerLaunch {
  readonly agentDriverId: string;
  readonly executableRef: string;
  readonly argv: readonly string[];
  readonly environmentMode: 'closed';
  readonly stdio: 'pipe';
  readonly protocolHint?: string;
}

export interface SpawnWorkerRequest {
  readonly runId: string;
  readonly operationId: string;
  readonly party: 'worker';
  readonly workspace: HostWorkspaceHandle;
  readonly cwd: string;
  readonly launch: WorkerLaunch;
  readonly injection: HostInjectionContext;
  readonly timeoutSeconds: number;
}

export interface HostCommandRequest {
  readonly runId: string;
  readonly operationId: string;
  readonly party: CredentialParty;
  readonly kind: CommandKind;
  readonly workspace: HostWorkspaceHandle;
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly injection: HostInjectionContext;
  readonly timeoutSeconds: number;
}

export interface CommandResult {
  readonly operationId: string;
  readonly commandDigest: string;
  readonly cwd: string;
  readonly exitCode?: number;
  readonly signal?: string;
  readonly stdoutRef: ArtifactRef;
  readonly stderrRef: ArtifactRef;
  readonly outputDigest: string;
  readonly redactionApplied: boolean;
  readonly startedAt: string;
  readonly finishedAt: string;
}

export interface WorkerHandle {
  readonly handleId: string;
  readonly runId: string;
  readonly operationId: string;
  readonly workspaceHandleId: string;
  readonly ownershipClass: 'owned' | 'owned-remote' | 'observe-only';
  readonly containmentRef: string;
  readonly startedAt: string;
}

export type HostObservation =
  | {
      readonly type: 'output';
      readonly handleId: string;
      readonly stream: 'stdout' | 'stderr';
      readonly outputRef: ArtifactRef;
      readonly digest: string;
      readonly redactionApplied: true;
      readonly at: string;
    }
  | {
      readonly type: 'structured-tool-exit';
      readonly handleId: string;
      readonly tool: string;
      readonly exitCode: number;
      readonly payloadRef?: ArtifactRef;
      readonly digest: string;
      readonly at: string;
    }
  | {
      readonly type: 'process-exit';
      readonly handleId: string;
      readonly exitCode?: number;
      readonly signal?: string;
      readonly at: string;
    }
  | {
      readonly type: 'host-failure';
      readonly handleId?: string;
      readonly failure: HostFailure;
      readonly at: string;
    };

export interface TerminationPolicy {
  readonly initialSignal: string;
  readonly graceSeconds: number;
  readonly forceKill: boolean;
  readonly proveEmptyTimeoutSeconds: number;
}

export interface TerminationProof {
  readonly signalSent: boolean;
  readonly graceObserved: boolean;
  readonly forceKillSent: boolean;
  readonly reaped: boolean;
  readonly containmentEmpty: boolean;
  readonly evidenceRef: ArtifactRef;
  readonly checkedAt: string;
}

export interface TerminationResult {
  readonly handleId: string;
  readonly terminalExitCode?: number;
  readonly terminalSignal?: string;
  readonly proof: TerminationProof;
  readonly failure?: HostFailure;
}

export interface HostReleaseResult {
  readonly workspaceHandleId: string;
  readonly released: boolean;
  readonly credentialMaterialDestroyed: boolean;
  readonly evidenceRef: ArtifactRef;
  readonly at: string;
  readonly failure?: HostFailure;
}

export interface HostFailure {
  readonly reason: HostFailureReason;
  readonly message: string;
  readonly retryable: boolean;
  readonly evidenceRef?: ArtifactRef;
  readonly at: string;
}

export interface HostProbeScope {
  readonly driverId: string;
  readonly driverVersion: string;
  readonly platform: string;
  readonly freshnessKey: string;
  readonly capabilities: readonly HostCapability[];
  readonly workspaceKind?: WorkspaceAttachment['kind'];
  readonly egressPolicy?: EgressPolicy;
  readonly at: string;
}

export type HostCapabilityScopeValue = string | number | boolean | null;

export interface HostNegativeProbeResult {
  readonly id: string;
  readonly host: string;
  readonly protocol: string;
  readonly expected: 'blocked';
  readonly observed: 'blocked' | 'reachable';
  readonly reason: string;
}

export interface HostCapabilityAttestationDetails {
  readonly containmentStrength?: string;
  readonly negativeProbeResults?: readonly HostNegativeProbeResult[];
  readonly egressPolicyDigest?: string;
}

export interface HostCapabilityAttestation {
  readonly eventId?: string;
  readonly capability: HostCapability;
  readonly probeMethod: string;
  readonly result: 'positive' | 'negative';
  readonly evidenceRef: ArtifactRef;
  readonly scope: Readonly<Record<string, HostCapabilityScopeValue>>;
  readonly expiry: string;
  readonly driverVersion: string;
  readonly platform: string;
  readonly freshnessKey: string;
  readonly at: string;
  readonly details?: HostCapabilityAttestationDetails;
}

export interface ExecutionHost {
  probeCapabilities(scope: HostProbeScope): readonly HostCapabilityAttestation[];
  attachWorkspace(workspace: WorkspaceAttachment): HostWorkspaceHandle | HostFailure;
  spawnWorker(request: SpawnWorkerRequest): WorkerHandle | HostFailure;
  observeWorker(handle: WorkerHandle): AsyncIterable<HostObservation>;
  terminateWorker(handle: WorkerHandle, policy: TerminationPolicy): TerminationResult;
  runCommand(request: HostCommandRequest): CommandResult | HostFailure;
  releaseWorkspace(handle: HostWorkspaceHandle): HostReleaseResult;
}
