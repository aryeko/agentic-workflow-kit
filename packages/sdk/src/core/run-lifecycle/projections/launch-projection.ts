import type {
  RunEventEnvelope,
  RunLaunchProjection,
  RunPolicyBoundPayload,
  RunReplay,
  SessionLinkedPayload,
  TaskSnapshotRecordedPayload,
} from '../contracts/index.js';

import { resolveSessionLinkage } from '../lifecycle/index.js';

function isRunPolicyBoundPayload(value: unknown): value is RunPolicyBoundPayload {
  return Boolean(value && typeof value === 'object' && 'policyDigest' in value && 'provenanceRef' in value);
}

function isTaskSnapshotRecordedPayload(value: unknown): value is TaskSnapshotRecordedPayload {
  return Boolean(
    value && typeof value === 'object' && 'taskId' in value && 'sourceRef' in value && 'snapshotDigest' in value,
  );
}

function sortLinkHistory(links: readonly SessionLinkedPayload[]): SessionLinkedPayload[] {
  return [...links].sort((left, right) => left.linkOrdinal - right.linkOrdinal);
}

function isRunPolicyBoundEvent(event: RunEventEnvelope): event is RunEventEnvelope<RunPolicyBoundPayload> {
  return event.type === 'RunPolicyBound' && isRunPolicyBoundPayload(event.payload);
}

function isTaskSnapshotRecordedEvent(event: RunEventEnvelope): event is RunEventEnvelope<TaskSnapshotRecordedPayload> {
  return event.type === 'TaskSnapshotRecorded' && isTaskSnapshotRecordedPayload(event.payload);
}

export function projectLaunch(replay: RunReplay): RunLaunchProjection {
  const firstPolicyBound = replay.events.find(isRunPolicyBoundEvent);
  const firstTaskSnapshot = replay.events.find(isTaskSnapshotRecordedEvent);
  const linkage = resolveSessionLinkage(replay.events);

  return {
    policyDigest: firstPolicyBound?.payload.policyDigest,
    taskSnapshotDigest: firstTaskSnapshot?.payload.snapshotDigest,
    linkage: linkage.launch.linkage,
    currentSession: linkage.currentSession,
    linkHistory: sortLinkHistory(linkage.linkHistory),
  };
}
