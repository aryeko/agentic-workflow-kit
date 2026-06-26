import type {
  AgentApprovalRequest,
  ApprovalContext,
  ApprovalRequest,
  ApprovalRiskClassification,
  CapabilityAttestation,
  CapabilityGateRecordPayload,
  ResolvedPolicy,
  RunEventEnvelope,
  RunProjections,
  RunReplay,
} from 'sdk';

export const runId = 'run-approval-01';
export const sessionId = 'session-approval-01';
export const evaluatedAt = '2026-06-26T09:01:00.000Z';

type RecordedEvidencePayload = {
  readonly evidenceRef: string;
  readonly supportKind: 'probe' | 'artifact-digest' | 'self-report' | 'schema-only' | 'feature-list';
  readonly value: string;
};

export const createContext = (overrides: Partial<ApprovalContext> = {}): ApprovalContext => ({
  runId,
  taskId: 'task-approval-01',
  operationId: 'op-approval-01',
  sessionId,
  policyRef: 'policy:approval',
  agentRequestEventId: 'evt-agent-request-01',
  worktreePath: '/workspace/story',
  requestedAt: '2026-06-26T09:00:00.000Z',
  promptRef: 'artifact://prompt-01',
  ...overrides,
});

export const createAgentRequest = (overrides: Partial<AgentApprovalRequest> = {}): AgentApprovalRequest => ({
  requestId: 'request-01',
  kind: 'command-execution',
  providerMethod: 'approval.request',
  prompt: 'Approve pnpm check',
  command: 'pnpm check',
  cwd: '/workspace/story',
  answerChannel: {
    channelRef: 'channel-01',
    providerRequestId: 'provider-request-01',
    persistable: true,
    evidenceRef: 'evidence:request-01',
    expiresAt: '2026-06-26T09:15:00.000Z',
  },
  ...overrides,
});

export const createRequest = (overrides: Partial<ApprovalRequest> = {}): ApprovalRequest => ({
  schema: 'kit-vnext.approval-request.v1',
  requestId: 'request-01',
  runId,
  taskId: 'task-approval-01',
  sessionId,
  operationId: 'op-approval-01',
  subject: 'command',
  promptRef: 'artifact://prompt-01',
  command: 'pnpm check',
  cwd: '/workspace/story',
  worktreePath: '/workspace/story',
  requestedScope: 'per-command',
  answerChannelRef: 'channel-01',
  answerChannelPersistable: true,
  requestedAt: '2026-06-26T09:00:00.000Z',
  expiresAt: '2026-06-26T09:15:00.000Z',
  policyRef: 'policy:approval',
  agentRequestEventId: 'evt-agent-request-01',
  ...overrides,
});

export const createPolicy = (overrides: Partial<ResolvedPolicy> = {}): ResolvedPolicy => ({
  schema: 'kit-vnext.resolved-policy.v1',
  policy: {
    run: {
      mode: 'assisted',
      maxConcurrentRuns: 1,
      requireCleanWorkspace: true,
    },
    provisioning: {
      ownershipClass: 'owned',
      containmentRequired: true,
      dependencyInstall: {
        defaultGrant: 'narrow',
        allowedPrefixes: ['pnpm install ', 'pnpm add '],
      },
    },
    approval: {
      mode: 'assisted',
      parkOnHumanLatency: true,
      requireRecordedDecision: true,
      decisionWindowMs: 900_000,
    },
    escalationPolicy: {
      allowedGrantScopes: ['per-command', 'per-command-prefix', 'session'],
      maxGrantScope: 'session',
      denyByDefault: true,
      grantRules: [
        {
          reason: 'verification',
          scope: 'per-command',
          prefixes: ['pnpm check'],
          requiresOperator: false,
        },
        {
          reason: 'worker-tool',
          scope: 'per-command-prefix',
          prefixes: ['pnpm '],
          requiresOperator: false,
        },
      ],
    },
    changePolicy: {
      allowedChangePaths: [],
    },
    capabilities: {
      'auto-merge': { desired: false, requireFreshAttestation: true },
      'auto-recover': { desired: false, requireFreshAttestation: true },
      'unattended-run': { desired: false, requireFreshAttestation: true },
      'escalation-auto-grant': { desired: true, requireFreshAttestation: true },
    },
    credentialRefs: { refs: [] },
    egress: { defaultAction: 'deny', rules: [], negativeProbes: [], requiredAttesters: [] },
    merge: {
      runnerMayPush: true,
      runnerMayOpenPr: true,
      runnerMayMerge: false,
      requiredEvidence: ['verification'],
    },
  },
  provenance: {
    'policy.approval.mode': {
      fieldPath: 'policy.approval.mode',
      sourceLayer: 'built-in-defaults',
      sourceRef: 'defaults',
      valueHash: 'sha256:approval-mode',
    },
  },
  resolvedPolicyHash: 'sha256:policy-01',
  ...overrides,
});

export const createEvent = <TPayload>({
  eventId,
  sequence,
  type,
  payload,
  domain = 'core-03',
  occurredAt = '2026-06-26T09:00:10.000Z',
  recordedAt = occurredAt,
  durability = 'durable',
}: {
  readonly eventId: string;
  readonly sequence: number;
  readonly type: string;
  readonly payload: TPayload;
  readonly domain?: string;
  readonly occurredAt?: string;
  readonly recordedAt?: string;
  readonly durability?: 'durable' | 'barrier';
}): RunEventEnvelope<TPayload> => ({
  schema: 'kit-vnext.run-event.v1',
  runId,
  eventId,
  sequence,
  writerEpoch: 2,
  domain,
  type,
  durability,
  occurredAt,
  recordedAt,
  payloadDigest: `sha256:${eventId}`,
  payload,
});

export const createEvidenceEvent = (
  eventId: string,
  sequence: number,
  evidenceRef: string,
  overrides: Partial<RecordedEvidencePayload> = {},
): RunEventEnvelope<RecordedEvidencePayload> =>
  createEvent({
    eventId,
    sequence,
    type: 'RecordedEvidence',
    domain: 'core-01',
    payload: {
      evidenceRef,
      supportKind: 'probe',
      value: evidenceRef,
      ...overrides,
    },
  });

export const createAttestationEvent = (
  eventId: string,
  sequence: number,
  capability: 'canRelayApproval' | 'canPersistApprovalAnswerChannel',
  overrides: Partial<CapabilityAttestation<string>> = {},
): RunEventEnvelope<CapabilityAttestation<string>> =>
  createEvent({
    eventId,
    sequence,
    type: 'CapabilityAttestation',
    domain: 'Agent',
    payload: {
      capability,
      probeMethod: 'live-smoke',
      result: 'positive',
      evidenceRef: `evidence:${capability}`,
      scope: sessionId,
      expiry: '2026-06-26T10:00:00.000Z',
      driverVersion: '1.0.0',
      platform: 'darwin-arm64',
      freshnessKey: `${capability}:${sessionId}`,
      at: '2026-06-26T08:59:00.000Z',
      ...overrides,
    },
  });

export const createReplay = (events: readonly RunEventEnvelope[] = []): RunReplay => ({
  runId,
  events: [...events],
  lastSequence: events.at(-1)?.sequence ?? 0,
  writerEpoch: 2,
  health: 'ok',
  healthRecords: [],
});

export const createProjections = (overrides: Partial<RunProjections> = {}): RunProjections => ({
  state: {
    lifecycle: 'running',
    currentSequence: 10,
    writerEpoch: 2,
    degradedHealth: 'ok',
  },
  summary: {
    runId,
    taskId: 'task-approval-01',
    status: 'running',
    ownerSessionId: sessionId,
    artifactRefs: [],
    unknownEvents: [],
  },
  metrics: {
    eventCount: 10,
    retryCount: 0,
    parkedMs: 0,
    firstRecordedAt: '2026-06-26T09:00:00.000Z',
    lastRecordedAt: evaluatedAt,
  },
  launch: {
    linkage: 'known',
    currentSession: {
      linkOrdinal: 1,
      sessionId,
      linkRole: 'primary',
      startedAt: '2026-06-26T08:58:00.000Z',
      sourceEventId: 'evt-session-linked-01',
    },
    linkHistory: [],
  },
  ...overrides,
});

export const createBaseReplay = (): RunReplay =>
  createReplay([
    createEvidenceEvent('evt-evidence-request-01', 1, 'evidence:request-01'),
    createEvidenceEvent('evt-evidence-relay-01', 2, 'evidence:canRelayApproval'),
    createEvidenceEvent('evt-evidence-persist-01', 3, 'evidence:canPersistApprovalAnswerChannel'),
    createAttestationEvent('evt-attest-relay-01', 4, 'canRelayApproval', {
      evidenceRef: 'evidence:canRelayApproval',
    }),
    createAttestationEvent('evt-attest-persist-01', 5, 'canPersistApprovalAnswerChannel', {
      evidenceRef: 'evidence:canPersistApprovalAnswerChannel',
    }),
  ]);

export const createClassification = (
  overrides: Partial<ApprovalRiskClassification> = {},
): ApprovalRiskClassification => ({
  risk: 'low',
  triggeredRuleIds: ['approval-low-command-allowlist'],
  evidenceEventIds: ['evt-agent-request-01', 'evt-session-linked-01'],
  classifiedAt: evaluatedAt,
  ...overrides,
});

export const createGateRecordPayload = (
  overrides: Partial<CapabilityGateRecordPayload> = {},
): CapabilityGateRecordPayload => ({
  schema: 'kit-vnext.capability-gate-record.v1',
  gateId: 'gate-approval-01',
  capability: 'escalation-auto-grant',
  decision: 'allow',
  mode: 'assisted',
  scope: {
    runId,
    operationId: 'op-approval-01',
    providerScopes: [],
    sessionId,
  },
  policyRef: 'policy:approval',
  requestedByDomain: 'core-03',
  requestedAction: 'approval-auto-grant',
  evaluatedAt,
  evaluatedGuarantees: [],
  attestationRefs: [],
  evidenceRefs: ['evidence:request-01'],
  ...overrides,
});

export const allowGate = () => ({
  status: 'allow' as const,
  eventId: 'evt-gate-allow-01',
  record: createGateRecordPayload(),
});

export const denyGate = () => ({
  status: 'deny' as const,
  eventId: 'evt-gate-deny-01',
  record: createGateRecordPayload({ decision: 'deny', failureReason: 'policy-disallows-capability' }),
});

export const createIdGenerator = (...ids: string[]) => {
  let index = 0;
  return () => {
    const next = ids[index];
    index += 1;
    return next ?? `generated-${index}`;
  };
};
