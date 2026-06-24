import type { RunEventCursor } from '../../../src/core/run-lifecycle/contracts/index.js';
import type {
  DeferredExternalTriggerActorRef,
  InspectRunParams,
  OperatorActionRecordedPayload,
  OperatorCommandEnvelope,
  OperatorCommandError,
  OperatorCommandResult,
  OperatorCommandTarget,
  OperatorEnvelopeError,
  OperatorEventRef,
  OsUserOperatorActorRef,
  PreviewRunParams,
  PreviewRunView,
  RunInspectionView,
  RunStartedView,
  StartRunParams,
  UnavailableOsUserOperatorActorRef,
} from '../../../src/edge/operator-command/index.js';

export const baseTimestamp = '2026-06-23T12:00:00.000Z';
export const workSourceId = 'work-source:tracker';
export const runId = 'run-123';

export const runEventCursorFixture: RunEventCursor = {
  runId,
  afterSequence: 4,
};

export const osUserOperatorActorFixture: OsUserOperatorActorRef = {
  schema: 'kit-vnext.operator-actor.v1',
  kind: 'os-user',
  username: 'arye',
  uid: 501,
  gid: 20,
  groups: ['staff', 'engineering'],
  hostname: 'build-host',
  processId: 3210,
  terminalRef: 'tty-001',
  surfaceClient: 'cli',
  resolvedAt: baseTimestamp,
  identityConfidence: 'verified-os',
};

export const unavailableOsUserOperatorActorFixture: UnavailableOsUserOperatorActorRef = {
  schema: 'kit-vnext.operator-actor.v1',
  kind: 'os-user-unavailable',
  hostname: 'build-host',
  processId: 3210,
  terminalRef: 'tty-001',
  surfaceClient: 'mcp',
  resolvedAt: baseTimestamp,
  failureReason: 'lookup-failed',
  identityConfidence: 'unverified',
};

export const deferredExternalTriggerActorFixture: DeferredExternalTriggerActorRef = {
  schema: 'kit-vnext.operator-actor.v1',
  kind: 'external-trigger',
  principalRef: 'trigger://scheduler/nightly',
  authEvidenceRef: 'artifact://auth-1',
  resolvedAt: baseTimestamp,
  identityConfidence: 'unverified',
};

export const operatorCommandTargetFixture: OperatorCommandTarget = {
  runId,
  taskId: 'task-1',
  trackId: 'track-a',
  approvalRequestId: 'approval-1',
  attentionId: 'attention-1',
};

export const operatorEnvelopeErrorFixture: OperatorEnvelopeError = {
  code: 'params-invalid',
  field: 'params.taskIds',
  message: 'taskIds must contain known task ids',
};

export const previewRunParamsFixture: PreviewRunParams = {
  workSource: {
    workSourceId,
  },
  trackIds: ['track-a'],
  taskIds: ['task-1'],
  profileName: 'standard',
  dryRun: true,
};

export const previewRunViewFixture: PreviewRunView = {
  workSource: {
    workSourceId,
  },
  profileName: 'standard',
  dryRun: true,
  selectedTrackIds: ['track-a'],
  selectedTaskIds: ['task-1'],
  candidateCount: 1,
};

export const startRunParamsFixture: StartRunParams = {
  workSource: {
    workSourceId,
  },
  selection: {
    mode: 'task',
    trackId: 'track-a',
    taskId: 'task-1',
  },
  profileName: 'standard',
  concurrencyKey: 'track-a',
  idempotencyKey: 'start-1',
};

export const startRunNextEligibleParamsFixture: StartRunParams = {
  workSource: {
    workSourceId,
  },
  selection: {
    mode: 'next-eligible',
    trackId: 'track-a',
  },
  profileName: 'standard',
};

export const runStartedViewFixture: RunStartedView = {
  workSource: {
    workSourceId,
  },
  profileName: 'standard',
  selection: {
    mode: 'task',
    trackId: 'track-a',
    taskId: 'task-1',
  },
  queued: false,
};

export const inspectRunParamsFixture: InspectRunParams = {
  runId,
  viewSelectors: ['state', 'events', 'approvals', 'gates', 'analysis'],
  cursor: runEventCursorFixture,
  limit: 25,
};

export const runInspectionViewFixture: RunInspectionView = {
  runId,
  includedViews: ['state', 'events', 'approvals', 'gates', 'analysis'],
  cursor: runEventCursorFixture,
  nextCursor: {
    runId,
    afterSequence: 7,
  },
  state: {
    lifecycle: 'running',
    currentSequence: 7,
  },
  events: {
    eventIds: ['evt-1', 'evt-2'],
  },
  approvals: {
    requestIds: ['approval-1'],
  },
  gates: {
    recordIds: ['gate-1'],
  },
  analysis: {
    recordIds: ['analysis-1'],
    reportRefs: ['artifact://analysis-1'],
  },
};

export const operatorCommandEnvelopeFixture: OperatorCommandEnvelope<PreviewRunParams> = {
  schema: 'kit-vnext.operator-command.v1',
  actionId: 'action-1',
  actionKind: 'preview-run',
  commandName: 'workflow run preview',
  surface: 'cli',
  actor: osUserOperatorActorFixture,
  target: operatorCommandTargetFixture,
  params: previewRunParamsFixture,
  paramsDigest: 'sha256:params',
  idempotencyKey: 'envelope-idem-1',
  requestedAt: baseTimestamp,
  reason: 'preview before run start',
  correlationId: 'corr-1',
  dryRun: true,
  envelopeErrors: [operatorEnvelopeErrorFixture],
};

export const operatorEventRefFixture: OperatorEventRef = {
  eventId: 'evt-operator-1',
  sequence: 7,
  payloadDigest: 'sha256:operator-action',
  type: 'OperatorActionRecorded',
};

export const operatorCommandErrorFixture: OperatorCommandError = {
  code: 'preview-rejected',
  message: 'preview was rejected',
  evidenceRefs: [operatorEventRefFixture],
};

export const operatorCommandResultFixture: OperatorCommandResult<PreviewRunView> = {
  schema: 'kit-vnext.operator-command-result.v1',
  actionId: 'action-1',
  status: 'completed',
  operatorEventRef: operatorEventRefFixture,
  runId,
  cursor: runEventCursorFixture,
  view: previewRunViewFixture,
  errors: [operatorCommandErrorFixture],
};

export const operatorActionRecordedPayloadFixture: OperatorActionRecordedPayload = {
  schema: 'kit-vnext.operator-action-recorded.v1',
  actionId: 'action-1',
  actionKind: 'preview-run',
  commandName: 'workflow run preview',
  surface: 'cli',
  actor: osUserOperatorActorFixture,
  target: operatorCommandTargetFixture,
  paramsDigest: 'sha256:params',
  idempotencyKey: 'envelope-idem-1',
  requestedAt: baseTimestamp,
  acceptedAt: '2026-06-23T12:00:01.000Z',
  reasonDigest: 'sha256:reason',
  resultIntent: 'read',
  envelopeErrors: [operatorEnvelopeErrorFixture],
};
