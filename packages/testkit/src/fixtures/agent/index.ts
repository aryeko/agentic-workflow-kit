import type {
  AgentApprovalRequest,
  AgentOutputSink,
  AgentProbeScope,
  AgentStartRequest,
  ApprovalAnswer,
  ApprovalKind,
  ScopedGrant,
  ScopedGrantKind,
  WorkerHandle,
} from 'sdk';

const at = '2026-06-22T10:00:00.000Z';
const expiresAt = '2026-06-22T11:00:00.000Z';

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  }

  const entries = Object.entries(value)
    .filter(([, entry]) => entry !== undefined)
    .sort(([left], [right]) => left.localeCompare(right));

  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
};

const digest = (value: unknown): string => {
  let hash = 0x811c9dc5;
  for (const char of stableStringify(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }

  return `sha256:mock-${hash.toString(16).padStart(8, '0')}`;
};

export interface MockAgentOutputSink extends AgentOutputSink {
  readonly getRecords: () => readonly Parameters<AgentOutputSink['putToolOutput']>[0][];
}

export const createMockAgentOutputSink = (): MockAgentOutputSink => {
  let records: readonly Parameters<AgentOutputSink['putToolOutput']>[0][] = [];

  return {
    putToolOutput: (input) => {
      records = [...records, { ...input }];

      return {
        outputRef: `artifact://testkit/agent/tool-output/${input.toolObservationId}`,
        digest: digest(input),
        redactionApplied: true,
      };
    },
    getRecords: () => records.map((record) => ({ ...record })),
  };
};

export const agentWorkerHandleFixture = (overrides: Partial<WorkerHandle> = {}): WorkerHandle => ({
  handleId: 'worker-handle-01',
  runId: 'run-01',
  operationId: 'op-01',
  workspaceHandleId: 'workspace-handle-01',
  ownershipClass: 'owned',
  containmentRef: 'containment://op-01',
  startedAt: at,
  ...overrides,
});

export const agentProbeScopeFixture = (overrides: Partial<AgentProbeScope> = {}): AgentProbeScope => ({
  driverId: 'testkit-agent',
  driverVersion: '0.0.0',
  platform: 'testkit',
  protocolSurface: 'mock',
  freshnessKey: 'testkit-agent:run-01',
  capabilities: ['canRelayApproval', 'emitsStructuredToolExit'],
  hostAttestationIds: ['host-attestation-01'],
  evidenceRequired: 'adversarial',
  at,
  ...overrides,
});

export const scopedGrantFixture = (overrides: Partial<ScopedGrant> = {}): ScopedGrant => ({
  grantId: 'grant-01',
  kind: 'command-once',
  scope: 'request',
  command: 'pnpm --filter testkit test',
  grantEventId: 'grant-event-01',
  ...overrides,
});

export const agentApprovalRequestFixture = (
  overrides: Partial<AgentApprovalRequest> & {
    readonly kind?: ApprovalKind;
    readonly proposedGrantKind?: ScopedGrantKind;
  } = {},
): AgentApprovalRequest => {
  const requestId = overrides.requestId ?? 'approval-request-01';

  return {
    requestId,
    kind: overrides.kind ?? 'command-execution',
    providerMethod: 'mock/approval',
    prompt: 'Allow testkit command?',
    command: 'pnpm --filter testkit test',
    cwd: '/tmp/worktrees/run-01',
    proposedGrant: scopedGrantFixture({ kind: overrides.proposedGrantKind ?? 'command-once' }),
    answerChannel: {
      channelRef: `agent-channel://${requestId}`,
      providerRequestId: `provider-${requestId}`,
      providerApprovalId: `provider-approval-${requestId}`,
      turnId: 'turn-01',
      expiresAt,
      persistable: true,
      evidenceRef: `artifact://testkit/agent/approval/${requestId}`,
    },
    ...overrides,
  };
};

export const agentApprovalAnswerFixture = (overrides: Partial<ApprovalAnswer> = {}): ApprovalAnswer => ({
  requestId: 'approval-request-01',
  decisionEventId: 'approval-decision-01',
  grant: scopedGrantFixture(),
  ...overrides,
});

export const agentStartRequestFixture = (overrides: Partial<AgentStartRequest> = {}): AgentStartRequest => ({
  runId: 'run-01',
  taskId: 'task-01',
  operationId: 'op-01',
  hostWorker: agentWorkerHandleFixture(),
  prompt: 'Implement the testkit task.',
  approvalMode: 'manual',
  outputSink: createMockAgentOutputSink(),
  redactionSetId: 'redaction-set-01',
  ...overrides,
});
