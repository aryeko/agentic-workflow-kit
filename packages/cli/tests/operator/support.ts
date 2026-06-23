import type {
  InspectRunParams,
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
} from 'sdk';
import {
  buildFixtureRunEventCursor,
  buildFixtureRunProjections,
  DeterministicClock,
  DeterministicIdGenerator,
  FakeOperatorControlSurface,
  FakeOsIdentityResolver,
} from '../../../testkit/src/index.js';

export const fixedTimestamp = '2026-01-01T00:00:00.000Z';
export const fixedActionId = 'action-001';

export const sharedActorFixture: OsUserOperatorActorRef = {
  schema: 'kit-vnext.operator-actor.v1',
  kind: 'os-user',
  username: 'testuser',
  uid: 501,
  gid: 20,
  groups: ['staff'],
  hostname: 'testhost',
  processId: 1,
  terminalRef: 'tty-001',
  surfaceClient: 'cli',
  resolvedAt: fixedTimestamp,
  identityConfidence: 'verified-os',
};

export const unavailableActorFixture: UnavailableOsUserOperatorActorRef = {
  schema: 'kit-vnext.operator-actor.v1',
  kind: 'os-user-unavailable',
  hostname: 'testhost',
  processId: 1,
  terminalRef: 'tty-001',
  surfaceClient: 'cli',
  resolvedAt: fixedTimestamp,
  failureReason: 'lookup-failed',
  identityConfidence: 'unverified',
};

export const targetFixture: OperatorCommandTarget = {
  runId: 'run-123',
  taskId: 'task-123',
  trackId: 'track-123',
};

export const previewParamsFixture: PreviewRunParams = {
  workSource: {
    workSourceId: 'work-source:primary',
  },
  trackIds: ['track-123'],
  taskIds: ['task-123'],
  profileName: 'standard',
  dryRun: true,
};

export const startParamsFixture: StartRunParams = {
  workSource: {
    workSourceId: 'work-source:primary',
  },
  selection: {
    mode: 'task',
    taskId: 'task-123',
    trackId: 'track-123',
  },
  profileName: 'standard',
  concurrencyKey: 'track-123',
  idempotencyKey: 'start-idempotency-001',
};

export const inspectParamsFixture: InspectRunParams = {
  runId: targetFixture.runId ?? 'run-123',
  viewSelectors: ['state', 'events', 'approvals', 'gates', 'analysis'],
  cursor: buildFixtureRunEventCursor({
    runId: targetFixture.runId ?? 'run-123',
    afterSequence: 4,
  }),
  limit: 25,
};

export const previewEnvelopeErrorFixture: OperatorEnvelopeError = {
  code: 'params-invalid',
  field: 'workSource',
  message: 'missing',
};

export const buildClock = (timestamp = fixedTimestamp): DeterministicClock => new DeterministicClock(timestamp);

export const buildIds = (actionId = fixedActionId): DeterministicIdGenerator => new DeterministicIdGenerator(actionId);

export const buildControlSurface = (): FakeOperatorControlSurface => new FakeOperatorControlSurface();

export const buildIdentityResolver = (
  actor: OsUserOperatorActorRef | UnavailableOsUserOperatorActorRef = sharedActorFixture,
): FakeOsIdentityResolver => new FakeOsIdentityResolver(actor);

export const operatorEventRefFixture = (eventId = 'evt-operator-001'): OperatorEventRef => ({
  eventId,
  sequence: 7,
  payloadDigest: 'digest:operator-event',
  type: 'OperatorActionRecorded',
});

export const operatorCommandErrorFixture = (
  eventRef: OperatorEventRef = operatorEventRefFixture(),
): OperatorCommandError => ({
  code: 'operator-rejected',
  message: 'operator request rejected',
  evidenceRefs: [eventRef],
});

export const previewResultFixture = (actionId = fixedActionId): OperatorCommandResult<PreviewRunView> => ({
  schema: 'kit-vnext.operator-command-result.v1',
  actionId,
  status: 'completed',
  view: {
    workSource: previewParamsFixture.workSource,
    profileName: previewParamsFixture.profileName,
    dryRun: true,
    selectedTrackIds: previewParamsFixture.trackIds,
    selectedTaskIds: previewParamsFixture.taskIds,
    candidateCount: 1,
  },
  errors: [],
});

export const startResultFixture = (actionId = fixedActionId): OperatorCommandResult<RunStartedView> => ({
  schema: 'kit-vnext.operator-command-result.v1',
  actionId,
  status: 'accepted',
  runId: targetFixture.runId,
  view: {
    workSource: startParamsFixture.workSource,
    profileName: startParamsFixture.profileName,
    selection: startParamsFixture.selection,
    queued: true,
  },
  errors: [],
});

export const inspectResultFixture = (actionId = fixedActionId): OperatorCommandResult<RunInspectionView> => ({
  schema: 'kit-vnext.operator-command-result.v1',
  actionId,
  status: 'completed',
  runId: inspectParamsFixture.runId,
  cursor: inspectParamsFixture.cursor,
  view: {
    runId: inspectParamsFixture.runId,
    includedViews: inspectParamsFixture.viewSelectors,
    cursor: inspectParamsFixture.cursor,
    nextCursor: buildFixtureRunEventCursor({
      runId: inspectParamsFixture.runId,
      afterSequence: 7,
    }),
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
  },
  errors: [],
});

export const projectionsFixture = buildFixtureRunProjections();

const parityStrippedKeys = new Set([
  'surface',
  'surfaceClient',
  'processId',
  'terminalRef',
  'uid',
  'gid',
  'groups',
  'hostname',
  'requestedAt',
]);

export const stripParityFields = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => stripParityFields(item));
  }

  if (value && typeof value === 'object') {
    const stripped: Record<string, unknown> = {};

    for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
      if (parityStrippedKeys.has(key)) {
        continue;
      }

      stripped[key] = stripParityFields(nestedValue);
    }

    return stripped;
  }

  return value;
};

export const serialize = (value: unknown): string => JSON.stringify(value);
