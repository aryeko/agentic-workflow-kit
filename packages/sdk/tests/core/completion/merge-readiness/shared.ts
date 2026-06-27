import type {
  AppendIntent,
  CapabilityGateRecordPayload,
  CapabilityGateScope,
  EvidenceEventRef,
  ForgeEvidenceSnapshot,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunWriter,
} from '../../../../src/index.js';
import type {
  EvaluateMergeReadinessInput,
  MergeAllowedInput,
} from '../../../../src/core/completion/merge-readiness/index.js';

type CapturingWriter = RunWriter & {
  readonly appendCalls: AppendIntent[][];
};

export const runId = 'run-merge-readiness-01';
export const evaluatedAt = '2026-06-27T11:00:00.000Z';
export const candidateHeadSha = 'head-merge-01';
export const baseSha = 'base-merge-01';

export const createEvidenceRef = (eventId: string, type: string, sequence: number): EvidenceEventRef => ({
  eventId,
  sequence,
  payloadDigest: `sha256:${eventId}`,
  type,
});

export const forgeRef = createEvidenceRef('evt-forge-evidence-01', 'ForgeEvidenceCollected', 31);
export const gateRef = createEvidenceRef('evt-gate-record-01', 'CapabilityGateRecord', 32);

export const pullRequestRef = 'pr:124';

export const providerScopes: CapabilityGateScope['providerScopes'] = [
  {
    provider: 'Forge',
    scope: 'repo:aryeko/workflow-kit/pr:124/head#head-merge-01',
    freshnessKey: 'forge:pr:124',
    approvedParentScopes: ['repo:aryeko/workflow-kit/pr:124'],
  },
];

export const gateEvidenceRefs = ['artifact://forge/pr-124', 'artifact://verify/head-merge-01'] as const;

export const createForgeSnapshot = (overrides: Partial<ForgeEvidenceSnapshot> = {}): ForgeEvidenceSnapshot => ({
  repo: {
    provider: 'github',
    host: 'github.com',
    owner: 'aryeko',
    repo: 'workflow-kit',
    defaultBaseRef: 'v-next',
    credentialRefId: 'cred-forge',
  },
  pullRequest: {
    providerPullRequestId: 'PR_kwDOExample',
    number: 124,
    url: 'https://github.com/aryeko/workflow-kit/pull/124',
    baseRef: 'v-next',
    headRef: 'codex/epic5-core-05-s3',
    author: 'codex',
    headSha: candidateHeadSha,
  },
  expectedHeadSha: candidateHeadSha,
  prState: {
    baseRefOid: baseSha,
    headRefOid: candidateHeadSha,
    state: 'OPEN',
    reviewDecision: 'APPROVED',
    mergeStateStatus: 'CLEAN',
    isInMergeQueue: false,
  },
  statusChecks: {
    state: 'SUCCESS',
    contexts: [
      { name: 'check', state: 'SUCCESS', conclusion: 'SUCCESS' },
      { name: 'lint', state: 'SUCCESS', conclusion: 'SUCCESS' },
    ],
  },
  reviewThreads: {
    threads: [
      { id: 'thread-1', isResolved: true, viewerCanResolve: false, path: 'packages/sdk/src/index.ts', comments: [] },
    ],
  },
  protection: {
    branchProtectionRules: [
      {
        pattern: 'v-next',
        requiredStatusCheckContexts: ['check'],
        requiresApprovingReviews: true,
        requiresStatusChecks: true,
        requiresStrictStatusChecks: true,
        requiresCommitSignatures: false,
        allowsForcePushes: false,
        allowsDeletions: false,
        blocksCreations: false,
      },
    ],
    rulesets: [
      { id: 'ruleset-1', name: 'default', enforcement: 'active', requiredStatusChecks: ['lint'], target: 'branch' },
    ],
  },
  mergeQueue: { mergeQueuePresent: false },
  scope: {
    driverId: 'provider-github',
    driverVersion: '1.0.0',
    provider: 'github',
    host: 'github.com',
    freshnessKey: 'provider-github:1.0.0:github.com',
    capabilities: ['supportsRulesets', 'supportsMergeQueue', 'supportsThreadResolution', 'canInspectProtection'],
    at: evaluatedAt,
  },
  evidenceRefs: [...gateEvidenceRefs],
  redactionFingerprintIds: ['redaction-1'],
  credentialAuditEventIds: ['evt-cred-1'],
  collectedAt: evaluatedAt,
  ...overrides,
});

export const createGateRecord = (
  overrides: Partial<CapabilityGateRecordPayload> = {},
): CapabilityGateRecordPayload => ({
  schema: 'kit-vnext.capability-gate-record.v1',
  gateId: 'gate-auto-merge-01',
  capability: 'auto-merge',
  decision: 'allow',
  mode: 'assisted',
  scope: {
    runId,
    operationId: 'merge-intent-01',
    providerScopes: [...providerScopes],
    pullRequestRef,
    expectedHeadSha: candidateHeadSha,
  },
  policyRef: 'policy:merge',
  requestedByDomain: 'core-05',
  requestedAction: 'merge-pull-request',
  evaluatedAt,
  evaluatedGuarantees: [],
  attestationRefs: [],
  evidenceRefs: [...gateEvidenceRefs],
  ...overrides,
});

export const createMergeAllowedInput = (overrides: Partial<MergeAllowedInput> = {}): MergeAllowedInput => ({
  candidateHeadSha,
  completionDecision: {
    eventId: 'evt-completion-verified-01',
    state: 'completion-verified',
    headSha: candidateHeadSha,
  },
  policy: {
    policyRef: 'policy:merge',
    runnerMayMerge: true,
    requiredEvidence: ['verification', 'ci', 'review', 'threads-resolved', 'protection'],
    allowedMethod: 'merge',
    selectedMethod: 'merge',
  },
  local: {
    headSha: candidateHeadSha,
    clean: true,
    changedFilesAllowed: true,
    verificationFresh: true,
  },
  forge: {
    ref: forgeRef,
    snapshot: createForgeSnapshot(),
    protectionFresh: true,
    expectedBaseSha: baseSha,
  },
  gate: {
    record: createGateRecord(),
    ref: gateRef,
    pullRequestRef,
    providerScopes: [...providerScopes],
    evidenceRefs: [...gateEvidenceRefs],
  },
  ...overrides,
});

export const createEvaluateInput = (
  overrides: Partial<EvaluateMergeReadinessInput> = {},
): EvaluateMergeReadinessInput => ({
  runId,
  evaluatedAt,
  ...createMergeAllowedInput(),
  ...overrides,
});

export const appendReceipt: RunAppendReceipt = {
  runId,
  firstSequence: 41,
  lastSequence: 41,
  writerEpoch: 1,
  durability: 'barrier',
  eventIds: ['evt-merge-decision-01'],
  payloadDigests: ['sha256:merge-decision-01'],
  frameDigest: 'sha256:frame-merge-01',
  health: 'ok',
};

export const createWriter = (
  appendImpl?: (batch: AppendIntent[]) => Result<RunAppendReceipt, RunAppendFailure>,
): CapturingWriter => {
  const appendCalls: AppendIntent[][] = [];
  const writer: CapturingWriter = {
    appendCalls,
    append(batch) {
      appendCalls.push(batch);
      return appendImpl?.(batch) ?? { ok: true, value: appendReceipt };
    },
    renew() {
      return { ok: true, value: writer };
    },
  };
  return writer;
};
