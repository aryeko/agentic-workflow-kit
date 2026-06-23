import type {
  RunEventEnvelope,
  RunLaunchProjection,
  RunReplay,
  RunStateProjection,
  RunSummaryProjection,
  TaskSnapshotRecordedPayload,
} from '../contracts/index.js';

const CORE_01_EVENT_TYPES = new Set([
  'RunCreated',
  'RunPolicyBound',
  'TaskSnapshotRecorded',
  'RunLifecycleTransitioned',
  'SessionLinked',
  'SessionLinkSuperseded',
  'RunLogTailRepaired',
  'RunAppendRejected',
]);

function isTaskSnapshotRecordedPayload(value: unknown): value is TaskSnapshotRecordedPayload {
  return Boolean(
    value && typeof value === 'object' && 'taskId' in value && 'sourceRef' in value && 'snapshotDigest' in value,
  );
}

function collectArtifactRefs(events: readonly RunEventEnvelope[]): string[] {
  const refs = new Set<string>();

  for (const event of events) {
    for (const ref of event.artifactRefs ?? []) {
      refs.add(ref);
    }
  }

  return [...refs];
}

function findTaskId(events: readonly RunEventEnvelope[]): string | undefined {
  const taskSnapshot = events.find(
    (event): event is RunEventEnvelope<TaskSnapshotRecordedPayload> =>
      event.type === 'TaskSnapshotRecorded' && isTaskSnapshotRecordedPayload(event.payload),
  );

  return taskSnapshot?.payload.taskId;
}

function collectUnknownEvents(events: readonly RunEventEnvelope[]): RunEventEnvelope[] {
  return events.filter((event) => !CORE_01_EVENT_TYPES.has(event.type));
}

export function projectSummary(
  replay: RunReplay,
  state: RunStateProjection,
  launch: RunLaunchProjection,
): RunSummaryProjection {
  return {
    runId: replay.runId,
    taskId: findTaskId(replay.events),
    status: state.lifecycle,
    ownerSessionId: launch.linkage === 'known' ? launch.currentSession?.sessionId : undefined,
    artifactRefs: collectArtifactRefs(replay.events),
    unknownEvents: collectUnknownEvents(replay.events),
  };
}
