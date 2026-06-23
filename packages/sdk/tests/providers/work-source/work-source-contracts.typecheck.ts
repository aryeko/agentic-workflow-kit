import type {
  AuditCitation,
  CapabilityAttestation,
  ClaimResult,
  SpecRef,
  TaskKey,
  TaskView,
  WorkSourceCapability,
  WorkSourceError,
  WorkSourceProbeScope,
  WorkSourceProvider,
} from '../../../src/index.js';

const taskKey: TaskKey = {
  workSourceId: 'work-source',
  trackId: 'track-a',
  taskId: 'task-1',
};

const specRef = {
  kind: 'path',
  ref: 'docs/spec.md',
} satisfies SpecRef;

const taskView = {
  key: taskKey,
  title: 'Task',
  status: { native: 'todo', bucket: 'eligible' },
  target: { project: 'sdk' },
  spec: { refs: [specRef] },
  dependencies: [],
  sourceRecordDigest: 'sha256:task',
} satisfies TaskView;

const claimResult = {
  task: taskView,
  snapshotRef: {
    id: 'artifact-1',
    digest: 'sha256:snapshot',
    size: 1,
    mediaType: 'application/json',
    retentionClass: 'evidence',
    classification: 'internal',
    redactionState: 'raw',
  },
  snapshotDigest: 'sha256:snapshot',
} satisfies ClaimResult;

const attestation = {
  capability: 'supportsClaim',
  probeMethod: 'mock-probe',
  result: 'positive',
  evidenceRef: 'artifact://work-source/probe',
  scope: 'provider',
  expiry: '2026-06-22T13:00:00.000Z',
  driverVersion: '1.0.0',
  platform: 'darwin-arm64',
  freshnessKey: 'work-source@1.0.0',
  at: '2026-06-22T12:00:00.000Z',
} satisfies CapabilityAttestation<WorkSourceCapability>;

const auditCitation = {
  runId: 'run-1',
  taskSnapshotRef: 'artifact://snapshot',
} satisfies AuditCitation;

const scope = {
  driverId: 'provider-markdown',
  driverVersion: '1.0.0',
  platform: 'darwin-arm64',
  sourceKind: 'markdown',
  freshnessKey: 'work-source@1.0.0',
  capabilities: ['supportsClaim'],
  at: '2026-06-22T12:00:00.000Z',
} satisfies WorkSourceProbeScope;

const provider = {
  probeCapabilities: () => [attestation],
  listTracks: () => [],
  listTasks: () => [],
  nextEligible: () => null,
  claim: () => claimResult,
  release: () => undefined,
  writeStatus: () => ({
    written: true,
    updatedRecordDigest: 'sha256:updated',
    auditCitation,
    at: '2026-06-22T12:30:00.000Z',
  }),
} satisfies WorkSourceProvider;

void provider;
void scope;

// @ts-expect-error AC-1 requires all seven operations.
const providerMissingWriteStatus: WorkSourceProvider = {
  probeCapabilities: () => [attestation],
  listTracks: () => [],
  listTasks: () => [],
  nextEligible: () => null,
  claim: () => claimResult,
  release: () => undefined,
};

const taskWithUnknownField: TaskView = {
  ...taskView,
  // @ts-expect-error AC-2 rejects unknown DTO fields.
  extraneous: true,
};

// @ts-expect-error AC-2 requires sourceRecordDigest.
const taskWithoutSourceRecordDigest: TaskView = {
  key: taskKey,
  title: 'Task',
  status: { native: 'todo', bucket: 'eligible' },
  target: { project: 'sdk' },
  spec: { refs: [specRef] },
  dependencies: [],
};

const invalidCapability: CapabilityAttestation<WorkSourceCapability> = {
  ...attestation,
  // @ts-expect-error AC-4 rejects unsupported work source capabilities.
  capability: 'supportsTracks2',
};

const invalidScope: WorkSourceProbeScope = {
  ...scope,
  // @ts-expect-error AC-4 rejects unsupported source kinds.
  sourceKind: 'github',
};

const staleClaimError = {
  kind: 'claim-conflict',
  task: taskKey,
  expectedRecordDigest: 'sha256:expected',
  observedRecordDigest: 'sha256:observed',
} satisfies WorkSourceError;

const invalidError: WorkSourceError = {
  // @ts-expect-error AC-5 rejects unsupported work source error kinds.
  kind: 'claim-stale',
};

const impossibleClaimResult: ClaimResult = {
  // @ts-expect-error AC-6 successful claim results cannot carry error discriminants.
  kind: staleClaimError.kind,
  task: taskView,
  snapshotRef: claimResult.snapshotRef,
  snapshotDigest: claimResult.snapshotDigest,
};

void providerMissingWriteStatus;
void taskWithUnknownField;
void taskWithoutSourceRecordDigest;
void invalidCapability;
void invalidScope;
void invalidError;
void impossibleClaimResult;
