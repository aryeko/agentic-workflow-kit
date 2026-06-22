import type {
  CommandResult,
  HostAttestationDetails,
  HostCommandRequest,
  HostFailure,
  HostInjectionContext,
  HostProbeScope,
  HostReleaseResult,
  HostWorkspaceHandle,
  SpawnWorkerRequest,
  TerminationPolicy,
  TerminationProof,
  TerminationResult,
  WorkerHandle,
  WorkerLaunch,
  WorkspaceAttachment,
} from '../../../src/index.js';

import {
  commandResultFixture,
  hostAttestationDetailsFixture,
  hostCommandRequestFixture,
  hostFailureFixture,
  hostInjectionContextFixture,
  hostProbeScopeFixture,
  hostReleaseResultFixture,
  hostWorkspaceHandleFixture,
  spawnWorkerRequestFixture,
  terminationPolicyFixture,
  terminationProofFixture,
  terminationResultFixture,
  workerHandleFixture,
  workerLaunchFixture,
  workspaceAttachmentFixture,
} from './fixtures/shared.js';

const workspaceAttachment = workspaceAttachmentFixture() satisfies WorkspaceAttachment;
const hostWorkspaceHandle = hostWorkspaceHandleFixture() satisfies HostWorkspaceHandle;
const hostInjectionContext = hostInjectionContextFixture() satisfies HostInjectionContext;
const workerLaunch = workerLaunchFixture() satisfies WorkerLaunch;
const spawnWorkerRequest = spawnWorkerRequestFixture() satisfies SpawnWorkerRequest;
const hostCommandRequest = hostCommandRequestFixture() satisfies HostCommandRequest;
const commandResult = commandResultFixture() satisfies CommandResult;
const workerHandle = workerHandleFixture() satisfies WorkerHandle;
const terminationPolicy = terminationPolicyFixture() satisfies TerminationPolicy;
const terminationProof = terminationProofFixture() satisfies TerminationProof;
const terminationResult = terminationResultFixture() satisfies TerminationResult;
const hostReleaseResult = hostReleaseResultFixture() satisfies HostReleaseResult;
const hostFailure = hostFailureFixture('worker-spawn-failed') satisfies HostFailure;
const hostProbeScope = hostProbeScopeFixture() satisfies HostProbeScope;
const hostAttestationDetails = hostAttestationDetailsFixture() satisfies HostAttestationDetails;

void workspaceAttachment;
void hostWorkspaceHandle;
void hostInjectionContext;
void workerLaunch;
void spawnWorkerRequest;
void hostCommandRequest;
void commandResult;
void workerHandle;
void terminationPolicy;
void terminationProof;
void terminationResult;
void hostReleaseResult;
void hostFailure;
void hostProbeScope;
void hostAttestationDetails;

// @ts-expect-error AC-2 WorkspaceAttachment requires branchName.
const workspaceAttachmentMissingBranchName: WorkspaceAttachment = {
  kind: 'local-worktree',
  leaseId: 'lease-01',
  runId: 'run-01',
  repoId: 'repo-01',
  worktreePath: '/tmp/worktrees/run-01',
};

// @ts-expect-error AC-2 HostWorkspaceHandle requires workspace.
const hostWorkspaceHandleMissingWorkspace: HostWorkspaceHandle = {
  handleId: 'workspace-handle-01',
  cwdRoot: '/tmp/worktrees/run-01',
  driverId: 'provider-local',
  attachedAt: '2026-06-22T10:00:00.000Z',
};

// @ts-expect-error AC-2 HostInjectionContext requires requiredAuditEvent.
const hostInjectionContextMissingAudit: HostInjectionContext = {
  operationId: 'op-01',
  party: 'worker',
  credentialRefIds: ['cred-01'],
  bindings: [],
  egressPolicy: hostInjectionContext.egressPolicy,
  redactionSet: hostInjectionContext.redactionSet,
  scopeDigest: 'scope-digest-01',
  attestationEventIds: ['att-01'],
  expiresAt: '2026-06-22T11:00:00.000Z',
};

// @ts-expect-error AC-2 WorkerLaunch requires stdio.
const workerLaunchMissingStdio: WorkerLaunch = {
  agentDriverId: 'provider-codex',
  executableRef: 'artifact://agent-binary',
  argv: ['--stdio'],
  environmentMode: 'closed',
};

// @ts-expect-error AC-2 SpawnWorkerRequest requires launch.
const spawnWorkerRequestMissingLaunch: SpawnWorkerRequest = {
  runId: 'run-01',
  operationId: 'op-01',
  party: 'worker',
  workspace: hostWorkspaceHandle,
  cwd: '/tmp/worktrees/run-01',
  injection: hostInjectionContext,
  timeoutSeconds: 1800,
};

// @ts-expect-error AC-2 HostCommandRequest requires kind.
const hostCommandRequestMissingKind: HostCommandRequest = {
  runId: 'run-01',
  operationId: 'op-verify-01',
  party: 'runner',
  workspace: hostWorkspaceHandle,
  argv: ['pnpm', 'check'],
  cwd: '/tmp/worktrees/run-01',
  injection: hostInjectionContext,
  timeoutSeconds: 3600,
};

// @ts-expect-error AC-2 CommandResult requires outputDigest.
const commandResultMissingOutputDigest: CommandResult = {
  operationId: 'op-verify-01',
  commandDigest: 'command-digest-01',
  cwd: '/tmp/worktrees/run-01',
  redactionApplied: true,
  startedAt: '2026-06-22T10:05:00.000Z',
  finishedAt: '2026-06-22T10:06:00.000Z',
};

// @ts-expect-error AC-2 WorkerHandle requires containmentRef.
const workerHandleMissingContainmentRef: WorkerHandle = {
  handleId: 'worker-handle-01',
  runId: 'run-01',
  operationId: 'op-01',
  workspaceHandleId: 'workspace-handle-01',
  ownershipClass: 'owned',
  startedAt: '2026-06-22T10:01:00.000Z',
};

// @ts-expect-error AC-2 TerminationPolicy requires proveEmptyTimeoutSeconds.
const terminationPolicyMissingTimeout: TerminationPolicy = {
  initialSignal: 'SIGTERM',
  graceSeconds: 10,
  forceKill: true,
};

// @ts-expect-error AC-2 TerminationProof requires checkedAt.
const terminationProofMissingCheckedAt: TerminationProof = {
  signalSent: true,
  graceObserved: true,
  forceKillSent: false,
  reaped: true,
  containmentEmpty: true,
  evidenceRef: 'artifact://termination-proof',
};

// @ts-expect-error AC-2 TerminationResult requires proof.
const terminationResultMissingProof: TerminationResult = {
  handleId: 'worker-handle-01',
  terminalExitCode: 0,
};

// @ts-expect-error AC-2 HostReleaseResult requires credentialMaterialDestroyed.
const hostReleaseResultMissingCredentialDestroyed: HostReleaseResult = {
  workspaceHandleId: 'workspace-handle-01',
  released: true,
  evidenceRef: 'artifact://release',
  at: '2026-06-22T10:09:00.000Z',
};

// @ts-expect-error AC-2 HostFailure requires reason.
const hostFailureMissingReason: HostFailure = {
  message: 'worker spawn failed',
  retryable: false,
  at: '2026-06-22T10:07:00.000Z',
};

// @ts-expect-error AC-2 HostProbeScope requires capabilities.
const hostProbeScopeMissingCapabilities: HostProbeScope = {
  driverId: 'provider-local',
  driverVersion: '1.0.0',
  platform: 'darwin-arm64',
  freshnessKey: 'provider-local:darwin-arm64',
  at: '2026-06-22T10:10:00.000Z',
};

const hostAttestationDetailsInvalidContainment: HostAttestationDetails = {
  // @ts-expect-error AC-2 HostAttestationDetails.containmentStrength must be a ContainmentStrength member.
  containmentStrength: 'pod',
};

void workspaceAttachmentMissingBranchName;
void hostWorkspaceHandleMissingWorkspace;
void hostInjectionContextMissingAudit;
void workerLaunchMissingStdio;
void spawnWorkerRequestMissingLaunch;
void hostCommandRequestMissingKind;
void commandResultMissingOutputDigest;
void workerHandleMissingContainmentRef;
void terminationPolicyMissingTimeout;
void terminationProofMissingCheckedAt;
void terminationResultMissingProof;
void hostReleaseResultMissingCredentialDestroyed;
void hostFailureMissingReason;
void hostProbeScopeMissingCapabilities;
void hostAttestationDetailsInvalidContainment;
