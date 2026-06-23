import type {
  HostCommandRequest,
  HostInjectionContext,
  HostProbeScope,
  HostWorkspaceHandle,
  SpawnWorkerRequest,
  TerminationPolicy,
  WorkspaceAttachment,
} from 'sdk';
export { executionHostIncidentFixtures, type ExecutionHostIncidentFixture } from './incidents.js';

const at = '2026-06-22T10:00:00.000Z';
const expiresAt = '2026-06-22T11:00:00.000Z';

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
  driverId: 'testkit-execution-host',
  attachedAt: at,
  ...overrides,
});

export const egressPolicyFixture = (
  overrides: Partial<HostInjectionContext['egressPolicy']> = {},
): HostInjectionContext['egressPolicy'] => ({
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
      driverId: 'testkit-execution-host',
      scopeDigest: 'scope-digest-01',
      egressPolicyDigest: 'egress-policy-digest-01',
      platform: 'darwin-arm64',
      driverVersion: '0.0.0',
      runtimeMetadataAvailable: true,
    },
  ],
  freshnessKey: 'testkit-execution-host:run-01',
  expiresAt,
  ...overrides,
});

export const credentialUsePlannedFixture = (
  overrides: Partial<HostInjectionContext['requiredAuditEvent']> = {},
): HostInjectionContext['requiredAuditEvent'] => ({
  type: 'CredentialUsePlanned',
  runId: 'run-01',
  taskId: 'task-01',
  operationId: 'op-01',
  credentialRefIds: ['cred-01'],
  party: 'worker',
  phase: 'worker-execution',
  policyDigest: 'policy-digest-01',
  credentialRefDigest: 'credential-ref-digest-01',
  scopeDigest: 'scope-digest-01',
  attestationEventIds: ['attestation-01'],
  evidenceRefs: ['artifact://credential-use-planned'],
  prevEventHash: 'prev-event-hash-01',
  at,
  eventHash: 'event-hash-01',
  egressPolicyId: 'egress-policy-01',
  expiresAt,
  reason: 'testkit fixture',
  ...overrides,
});

export const redactionSetFixture = (
  overrides: Partial<HostInjectionContext['redactionSet']> = {},
): HostInjectionContext['redactionSet'] => ({
  id: 'redaction-set-01',
  credentialRefIds: ['cred-01'],
  labels: { API_TOKEN: 'API_TOKEN' },
  fingerprintIds: ['fingerprint-01'],
  expiresAt,
  ...overrides,
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
  attestationEventIds: ['attestation-01'],
  expiresAt,
  ...overrides,
});

export const spawnWorkerRequestFixture = (overrides: Partial<SpawnWorkerRequest> = {}): SpawnWorkerRequest => ({
  runId: 'run-01',
  operationId: 'op-01',
  party: 'worker',
  workspace: hostWorkspaceHandleFixture(),
  cwd: '/tmp/worktrees/run-01',
  launch: {
    agentDriverId: 'provider-codex',
    executableRef: 'artifact://agent-binary',
    argv: ['--stdio'],
    environmentMode: 'closed',
    stdio: 'pipe',
    protocolHint: 'json-rpc',
  },
  injection: hostInjectionContextFixture(),
  timeoutSeconds: 1800,
  ...overrides,
});

export const runnerInjectionContextFixture = (overrides: Partial<HostInjectionContext> = {}): HostInjectionContext =>
  hostInjectionContextFixture({
    operationId: 'op-verify-01',
    party: 'runner',
    egressPolicy: egressPolicyFixture({ operationId: 'op-verify-01', audience: 'runner' }),
    requiredAuditEvent: credentialUsePlannedFixture({
      operationId: 'op-verify-01',
      party: 'runner',
      phase: 'runner-verify',
      reason: 'runner verify',
    }),
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
  injection: runnerInjectionContextFixture(),
  timeoutSeconds: 3600,
  ...overrides,
});

export const hostProbeScopeFixture = (overrides: Partial<HostProbeScope> = {}): HostProbeScope => ({
  driverId: 'testkit-execution-host',
  driverVersion: '0.0.0',
  platform: 'darwin-arm64',
  freshnessKey: 'testkit-execution-host:run-01',
  capabilities: ['canKill', 'containmentStrength'],
  workspaceKind: 'local-worktree',
  egressPolicy: egressPolicyFixture(),
  at,
  ...overrides,
});

export const terminationPolicyFixture = (overrides: Partial<TerminationPolicy> = {}): TerminationPolicy => ({
  initialSignal: 'SIGTERM',
  graceSeconds: 10,
  forceKill: true,
  proveEmptyTimeoutSeconds: 30,
  ...overrides,
});
