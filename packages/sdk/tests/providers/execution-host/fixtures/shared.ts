import type {
  CapabilityAttestation,
  CommandResult,
  ExecutionHostProvider,
  HostAttestationDetails,
  HostCommandRequest,
  HostFailure,
  HostFailureReason,
  HostInjectionContext,
  HostObservation,
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
} from '../../../../src/index.js';

export const workspaceAttachmentFixture = (overrides: Partial<WorkspaceAttachment> = {}): WorkspaceAttachment => ({
  kind: 'local-worktree',
  leaseId: 'lease-01',
  runId: 'run-01',
  repoId: 'repo-01',
  branchName: 'codex/epic2-provider-contracts',
  worktreePath: '/tmp/worktrees/run-01',
  ...overrides,
});

export const hostWorkspaceHandleFixture = (overrides: Partial<HostWorkspaceHandle> = {}): HostWorkspaceHandle => ({
  handleId: 'workspace-handle-01',
  workspace: workspaceAttachmentFixture(),
  cwdRoot: '/tmp/worktrees/run-01',
  driverId: 'provider-local',
  attachedAt: '2026-06-22T10:00:00.000Z',
  ...overrides,
});

export const credentialUsePlannedFixture = (): HostInjectionContext['requiredAuditEvent'] => ({
  type: 'CredentialUsePlanned',
  runId: 'run-01',
  taskId: 'task-01',
  operationId: 'op-01',
  credentialRefIds: ['cred-01'],
  party: 'worker',
  phase: 'worker-execution',
  policyDigest: 'policy-digest-01',
  credentialRefDigest: 'cred-digest-01',
  scopeDigest: 'scope-digest-01',
  attestationEventIds: ['att-01'],
  evidenceRefs: ['artifact://cred-use-planned'],
  prevEventHash: 'prev-event-hash-01',
  at: '2026-06-22T10:00:00.000Z',
  eventHash: 'event-hash-01',
  egressPolicyId: 'egress-policy-01',
  expiresAt: '2026-06-22T11:00:00.000Z',
  reason: 'worker launch',
});

export const redactionSetFixture = (): HostInjectionContext['redactionSet'] => ({
  id: 'redaction-set-01',
  credentialRefIds: ['cred-01'],
  labels: { API_TOKEN: 'API_TOKEN' },
  fingerprintIds: ['fingerprint-01'],
  expiresAt: '2026-06-22T11:00:00.000Z',
});

export const egressPolicyFixture = (): HostInjectionContext['egressPolicy'] => ({
  id: 'egress-policy-01',
  runId: 'run-01',
  operationId: 'op-01',
  audience: 'worker',
  egressPolicyDigest: 'egress-policy-digest-01',
  defaultAction: 'deny',
  rules: [
    {
      credentialRefIds: ['cred-01'],
      protocols: ['https'],
      hosts: ['github.com'],
      phase: 'worker-execution',
      purpose: 'fetch repository metadata',
    },
  ],
  negativeProbes: [
    {
      host: 'example.invalid',
      protocol: 'https',
      expected: 'blocked',
      reason: 'deny by default',
    },
  ],
  negativeProbeIds: ['negative-probe-01'],
  requiredAttesters: [
    {
      point: 'execution-host',
      capability: 'egress-confinement',
      driverId: 'provider-local',
      scopeDigest: 'scope-digest-01',
      egressPolicyDigest: 'egress-policy-digest-01',
    },
  ],
  freshnessKey: 'provider-local:run-01',
  expiresAt: '2026-06-22T11:00:00.000Z',
});

export const hostInjectionContextFixture = (overrides: Partial<HostInjectionContext> = {}): HostInjectionContext => ({
  operationId: 'op-01',
  party: 'worker',
  credentialRefIds: ['cred-01'],
  bindings: [
    {
      mode: 'env',
      nameOrPath: 'API_TOKEN',
      redactionLabel: 'API_TOKEN',
    },
  ],
  egressPolicy: egressPolicyFixture(),
  redactionSet: redactionSetFixture(),
  requiredAuditEvent: credentialUsePlannedFixture(),
  scopeDigest: 'scope-digest-01',
  attestationEventIds: ['att-01'],
  expiresAt: '2026-06-22T11:00:00.000Z',
  ...overrides,
});

export const workerLaunchFixture = (overrides: Partial<WorkerLaunch> = {}): WorkerLaunch => ({
  agentDriverId: 'provider-codex',
  executableRef: 'artifact://agent-binary',
  argv: ['--stdio'],
  environmentMode: 'closed',
  stdio: 'pipe',
  protocolHint: 'json-rpc',
  ...overrides,
});

export const spawnWorkerRequestFixture = (overrides: Partial<SpawnWorkerRequest> = {}): SpawnWorkerRequest => ({
  runId: 'run-01',
  operationId: 'op-01',
  party: 'worker',
  workspace: hostWorkspaceHandleFixture(),
  cwd: '/tmp/worktrees/run-01',
  launch: workerLaunchFixture(),
  injection: hostInjectionContextFixture(),
  timeoutSeconds: 1800,
  ...overrides,
});

export const hostCommandRequestFixture = (overrides: Partial<HostCommandRequest> = {}): HostCommandRequest => ({
  runId: 'run-01',
  operationId: 'op-verify-01',
  party: 'runner',
  kind: 'verify',
  workspace: hostWorkspaceHandleFixture(),
  argv: ['pnpm', 'check'],
  cwd: '/tmp/worktrees/run-01',
  injection: hostInjectionContextFixture({
    operationId: 'op-verify-01',
    party: 'runner',
    requiredAuditEvent: {
      ...credentialUsePlannedFixture(),
      operationId: 'op-verify-01',
      party: 'runner',
      egressPolicyId: 'egress-policy-01',
    },
  }),
  timeoutSeconds: 3600,
  ...overrides,
});

export const commandResultFixture = (overrides: Partial<CommandResult> = {}): CommandResult => ({
  operationId: 'op-verify-01',
  commandDigest: 'command-digest-01',
  cwd: '/tmp/worktrees/run-01',
  exitCode: 0,
  stdoutRef: 'artifact://stdout',
  stderrRef: 'artifact://stderr',
  outputDigest: 'output-digest-01',
  redactionApplied: true,
  startedAt: '2026-06-22T10:05:00.000Z',
  finishedAt: '2026-06-22T10:06:00.000Z',
  ...overrides,
});

export const workerHandleFixture = (overrides: Partial<WorkerHandle> = {}): WorkerHandle => ({
  handleId: 'worker-handle-01',
  runId: 'run-01',
  operationId: 'op-01',
  workspaceHandleId: 'workspace-handle-01',
  ownershipClass: 'owned',
  containmentRef: 'containment://worker-handle-01',
  startedAt: '2026-06-22T10:01:00.000Z',
  ...overrides,
});

export const outputObservationFixture = (
  overrides: Partial<Extract<HostObservation, { type: 'output' }>> = {},
): Extract<HostObservation, { type: 'output' }> => ({
  type: 'output',
  handleId: 'worker-handle-01',
  stream: 'stdout',
  outputRef: 'artifact://worker-output',
  digest: 'output-digest-01',
  redactionApplied: true,
  at: '2026-06-22T10:02:00.000Z',
  ...overrides,
});

export const structuredToolExitObservationFixture = (
  overrides: Partial<Extract<HostObservation, { type: 'structured-tool-exit' }>> = {},
): Extract<HostObservation, { type: 'structured-tool-exit' }> => ({
  type: 'structured-tool-exit',
  handleId: 'worker-handle-01',
  tool: 'apply_patch',
  exitCode: 0,
  payloadRef: 'artifact://tool-exit',
  digest: 'tool-exit-digest-01',
  at: '2026-06-22T10:03:00.000Z',
  ...overrides,
});

export const processExitObservationFixture = (
  overrides: Partial<Extract<HostObservation, { type: 'process-exit' }>> = {},
): Extract<HostObservation, { type: 'process-exit' }> => ({
  type: 'process-exit',
  handleId: 'worker-handle-01',
  exitCode: 0,
  at: '2026-06-22T10:04:00.000Z',
  ...overrides,
});

export const hostFailureFixture = (reason: HostFailureReason, overrides: Partial<HostFailure> = {}): HostFailure => ({
  reason,
  message: `${reason} occurred`,
  retryable: false,
  evidenceRef: `artifact://${reason}`,
  at: '2026-06-22T10:07:00.000Z',
  ...overrides,
});

export const hostFailureObservationFixture = (
  reason: HostFailureReason,
  overrides: Partial<Extract<HostObservation, { type: 'host-failure' }>> = {},
): Extract<HostObservation, { type: 'host-failure' }> => ({
  type: 'host-failure',
  handleId: 'worker-handle-01',
  failure: hostFailureFixture(reason),
  at: '2026-06-22T10:07:00.000Z',
  ...overrides,
});

export const terminationPolicyFixture = (overrides: Partial<TerminationPolicy> = {}): TerminationPolicy => ({
  initialSignal: 'SIGTERM',
  graceSeconds: 10,
  forceKill: true,
  proveEmptyTimeoutSeconds: 30,
  ...overrides,
});

export const terminationProofFixture = (overrides: Partial<TerminationProof> = {}): TerminationProof => ({
  signalSent: true,
  graceObserved: true,
  forceKillSent: false,
  reaped: true,
  containmentEmpty: true,
  evidenceRef: 'artifact://termination-proof',
  checkedAt: '2026-06-22T10:08:00.000Z',
  ...overrides,
});

export const terminationResultFixture = (overrides: Partial<TerminationResult> = {}): TerminationResult => ({
  handleId: 'worker-handle-01',
  terminalExitCode: 0,
  proof: terminationProofFixture(),
  ...overrides,
});

export const hostReleaseResultFixture = (overrides: Partial<HostReleaseResult> = {}): HostReleaseResult => ({
  workspaceHandleId: 'workspace-handle-01',
  released: true,
  credentialMaterialDestroyed: true,
  evidenceRef: 'artifact://release',
  at: '2026-06-22T10:09:00.000Z',
  ...overrides,
});

export const hostProbeScopeFixture = (overrides: Partial<HostProbeScope> = {}): HostProbeScope => ({
  driverId: 'provider-local',
  driverVersion: '1.0.0',
  platform: 'darwin-arm64',
  freshnessKey: 'provider-local:darwin-arm64',
  capabilities: ['canKill', 'containmentStrength'],
  workspaceKind: 'local-worktree',
  egressPolicy: egressPolicyFixture(),
  at: '2026-06-22T10:10:00.000Z',
  ...overrides,
});

export const hostAttestationDetailsFixture = (
  overrides: Partial<HostAttestationDetails> = {},
): HostAttestationDetails => ({
  containmentStrength: 'process-group',
  negativeProbeResults: egressPolicyFixture().negativeProbes,
  egressPolicyDigest: 'egress-policy-digest-01',
  ...overrides,
});

export const capabilityAttestationFixture = (
  overrides: Partial<CapabilityAttestation<'containmentStrength'>> = {},
): CapabilityAttestation<'containmentStrength'> => ({
  capability: 'containmentStrength',
  probeMethod: 'live-smoke',
  result: 'positive',
  evidenceRef: 'artifact://host-attestation',
  scope: 'execution-host',
  expiry: '2026-06-22T11:10:00.000Z',
  driverVersion: '1.0.0',
  platform: 'darwin-arm64',
  freshnessKey: 'provider-local:darwin-arm64',
  at: '2026-06-22T10:10:00.000Z',
  details: hostAttestationDetailsFixture(),
  ...overrides,
});

async function* observeWorkerFixture(handle: WorkerHandle): AsyncIterable<HostObservation> {
  yield outputObservationFixture({ handleId: handle.handleId });
}

export const executionHostProviderFixture = (
  overrides: Partial<ExecutionHostProvider> = {},
): ExecutionHostProvider => ({
  probeCapabilities: () => [capabilityAttestationFixture()],
  attachWorkspace: (workspace) => hostWorkspaceHandleFixture({ workspace }),
  spawnWorker: (request) =>
    workerHandleFixture({
      runId: request.runId,
      operationId: request.operationId,
      workspaceHandleId: request.workspace.handleId,
    }),
  observeWorker: (handle) => observeWorkerFixture(handle),
  terminateWorker: (handle) => terminationResultFixture({ handleId: handle.handleId }),
  runCommand: (request) =>
    commandResultFixture({
      operationId: request.operationId,
      cwd: request.cwd,
    }),
  releaseWorkspace: (handle) =>
    hostReleaseResultFixture({
      workspaceHandleId: handle.handleId,
    }),
  ...overrides,
});
