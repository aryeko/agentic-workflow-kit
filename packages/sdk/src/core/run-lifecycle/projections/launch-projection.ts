import type {
  RunEventEnvelope,
  RunLaunchProjection,
  RunLifecycleTransitionPayload,
  RunPolicyBoundPayload,
  RunReplay,
  SessionLinkedPayload,
  TaskSnapshotRecordedPayload,
} from '../contracts/index.js';

import { resolveSessionLinkage } from '../lifecycle/index.js';
import { isLifecycleTransitionPayload } from '../replay/payload-validator.js';

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

function isLifecycleTransitionEvent(event: RunEventEnvelope): event is RunEventEnvelope<RunLifecycleTransitionPayload> {
  return event.type === 'RunLifecycleTransitioned' && isLifecycleTransitionPayload(event.payload);
}

function referencedEvent(
  sourceEventId: string,
  sourceEventsById: ReadonlyMap<string, RunEventEnvelope>,
  expectedType: string,
): RunEventEnvelope | undefined {
  return (
    sourceEventsById.get(sourceEventId) ??
    (sourceEventId.startsWith(`${expectedType}:`)
      ? sourceEventsById.get(sourceEventId.slice(expectedType.length + 1))
      : undefined)
  );
}

function findLifecycleReferencedEvent<TPayload>(
  events: readonly RunEventEnvelope[],
  edge: Pick<RunLifecycleTransitionPayload, 'from' | 'to'>,
  expectedType: string,
  predicate: (event: RunEventEnvelope) => event is RunEventEnvelope<TPayload>,
): RunEventEnvelope<TPayload> | undefined {
  const sourceEventsById = new Map<string, RunEventEnvelope>();

  for (const event of events) {
    if (isLifecycleTransitionEvent(event) && event.payload.from === edge.from && event.payload.to === edge.to) {
      for (const sourceEventId of event.payload.sourceEventIds) {
        const referenced = referencedEvent(sourceEventId, sourceEventsById, expectedType);
        if (referenced !== undefined && predicate(referenced)) {
          return referenced;
        }
      }
    }

    sourceEventsById.set(event.eventId, event);
  }

  return undefined;
}

export function projectLaunch(replay: RunReplay): RunLaunchProjection {
  const policyBound = findLifecycleReferencedEvent(
    replay.events,
    { from: 'created', to: 'configured' },
    'RunPolicyBound',
    isRunPolicyBoundEvent,
  );
  const taskSnapshot = findLifecycleReferencedEvent(
    replay.events,
    { from: 'configured', to: 'task-snapshotted' },
    'TaskSnapshotRecorded',
    isTaskSnapshotRecordedEvent,
  );
  const linkage = resolveSessionLinkage(replay.events);

  return {
    policyDigest: policyBound?.payload.policyDigest,
    taskSnapshotDigest: taskSnapshot?.payload.snapshotDigest,
    linkage: linkage.launch.linkage,
    currentSession: linkage.currentSession,
    linkHistory: sortLinkHistory(linkage.linkHistory),
  };
}
