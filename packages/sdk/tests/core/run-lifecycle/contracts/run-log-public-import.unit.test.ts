import type {
  AppendIntent,
  CreateRunInput,
  EvidenceEventRef,
  Result,
  RunAppendFailure,
  RunAppendFailureCode,
  RunAppendReceipt,
  RunAppendRejectedPayload,
  RunCreatedPayload,
  RunDegradedHealth,
  RunDurabilityClass,
  RunEventCursor,
  RunEventEnvelope,
  RunEventLog,
  RunLaunchProjection,
  RunLifecycleState,
  RunLifecycleTransitionPayload,
  RunLogCorruptionRecord,
  RunLogHealthRecord,
  RunLogTailRepairedPayload,
  RunMetricsProjection,
  RunPolicyBoundPayload,
  RunProjections,
  RunReplay,
  RunReplayFailure,
  RunStateProjection,
  RunSummaryProjection,
  RunWriter,
  SessionLinkedPayload,
  SessionLinkSupersededPayload,
  TaskSnapshotRecordedPayload,
  WaitRunEventsRequest,
  WaitRunEventsResult,
} from 'sdk';
import { describe, expect, it } from 'vitest';

import {
  appendIntentFixture,
  createRunInputFixture,
  evidenceEventRefFixture,
  runAppendFailureFixture,
  runAppendReceiptFixture,
  runAppendRejectedPayloadFixture,
  runCreatedPayloadFixture,
  runEventCursorFixture,
  runEventEnvelopeFixture,
  runLaunchProjectionFixture,
  runLifecycleTransitionPayloadFixture,
  runLogCorruptionRecordFixture,
  runLogTailRepairedPayloadFixture,
  runMetricsProjectionFixture,
  runPolicyBoundPayloadFixture,
  runProjectionsFixture,
  runReplayFailureFixture,
  runReplayFixture,
  runStateProjectionFixture,
  runSummaryProjectionFixture,
  runWriterFixture,
  sessionLinkedPayloadFixture,
  sessionLinkSupersededPayloadFixture,
  taskSnapshotRecordedPayloadFixture,
  waitRunEventsRequestFixture,
  waitRunEventsResultFixture,
} from './public-import-support.js';

describe('core-01-s1 public sdk imports', () => {
  it('imports the run-lifecycle contract surface from the sdk entrypoint', () => {
    const result: Result<RunWriter, RunAppendFailure> = { ok: true, value: runWriterFixture };
    const durability: RunDurabilityClass = 'durable';
    const lifecycle: RunLifecycleState = 'running';
    const degradedHealth: RunDegradedHealth = 'ok';
    const envelope: RunEventEnvelope<RunCreatedPayload> = runEventEnvelopeFixture;
    const evidenceRef: EvidenceEventRef = evidenceEventRefFixture;
    const createRunInput: CreateRunInput = createRunInputFixture;
    const appendIntent: AppendIntent<RunLifecycleTransitionPayload> = appendIntentFixture;
    const appendReceipt: RunAppendReceipt = runAppendReceiptFixture;
    const replay: RunReplay = runReplayFixture;
    const cursor: RunEventCursor = runEventCursorFixture;
    const waitRequest: WaitRunEventsRequest = waitRunEventsRequestFixture;
    const waitResult: WaitRunEventsResult = waitRunEventsResultFixture;
    const projections: RunProjections = runProjectionsFixture;
    const state: RunStateProjection = runStateProjectionFixture;
    const summary: RunSummaryProjection = runSummaryProjectionFixture;
    const metrics: RunMetricsProjection = runMetricsProjectionFixture;
    const launch: RunLaunchProjection = runLaunchProjectionFixture;
    const appendFailureCode: RunAppendFailureCode = 'event-log-unavailable';
    const appendFailure: RunAppendFailure = runAppendFailureFixture;
    const appendRejectedPayload: RunAppendRejectedPayload = runAppendRejectedPayloadFixture;
    const replayFailure: RunReplayFailure = runReplayFailureFixture;
    const healthRecord: RunLogHealthRecord = runLogCorruptionRecordFixture;
    const corruptionRecord: RunLogCorruptionRecord = runLogCorruptionRecordFixture;
    const createdPayload: RunCreatedPayload = runCreatedPayloadFixture;
    const policyBoundPayload: RunPolicyBoundPayload = runPolicyBoundPayloadFixture;
    const taskSnapshotPayload: TaskSnapshotRecordedPayload = taskSnapshotRecordedPayloadFixture;
    const lifecyclePayload: RunLifecycleTransitionPayload = runLifecycleTransitionPayloadFixture;
    const linkedPayload: SessionLinkedPayload = sessionLinkedPayloadFixture;
    const supersededPayload: SessionLinkSupersededPayload = sessionLinkSupersededPayloadFixture;
    const tailRepairedPayload: RunLogTailRepairedPayload = runLogTailRepairedPayloadFixture;
    const log: RunEventLog = {
      createRun: () => result,
      openWriter: () => result,
      replay: () => ({ ok: true, value: replay }),
      waitRunEvents: () => ({ ok: true, value: waitResult }),
      project: () => ({ ok: true, value: projections }),
    };

    expect(envelope).toEqual(runEventEnvelopeFixture);
    expect(appendReceipt).toEqual(runAppendReceiptFixture);
    expect(log.createRun(createRunInput)).toEqual(result);
    expect(durability).toBe('durable');
    expect(lifecycle).toBe('running');
    expect(degradedHealth).toBe('ok');
    expect(evidenceRef.eventId).toBe(envelope.eventId);
    expect(appendIntent.type).toBe('RunLifecycleTransitioned');
    expect(cursor.runId).toBe(replay.runId);
    expect(waitRequest.cursor.afterSequence).toBe(1);
    expect(state.lifecycle).toBe(summary.status);
    expect(metrics.eventCount).toBeGreaterThan(0);
    expect(launch.linkHistory).toHaveLength(1);
    expect(appendFailureCode).toBe('event-log-unavailable');
    expect(appendFailure.rejection?.failureCode).toBe('stale-writer-fenced');
    expect(appendRejectedPayload.recordedReason).toBe('writer epoch fenced');
    expect(replayFailure.code).toBe('interior-corrupt');
    expect(healthRecord.kind).toBe('tail-repaired');
    expect(corruptionRecord.storageHealth).toBe('log-tail-repaired');
    expect(createdPayload.idempotencyKey).toBe('idem-1');
    expect(policyBoundPayload.policyDigest).toBe('sha256:policy');
    expect(taskSnapshotPayload.taskId).toBe('task-1');
    expect(lifecyclePayload.authority).toBe('policy');
    expect(linkedPayload.sessionId).toBe('session-1');
    expect(supersededPayload.supersededOrdinal).toBe(1);
    expect(tailRepairedPayload.storageHealth).toBe('log-tail-repaired');
  });
});
