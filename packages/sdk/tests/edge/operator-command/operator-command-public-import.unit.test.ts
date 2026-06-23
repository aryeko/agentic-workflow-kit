import type {
  DeferredExternalTriggerActorRef,
  InspectRunParams,
  OperatorActionKind,
  OperatorActionRecordedPayload,
  OperatorActorRef,
  OperatorCommandEnvelope,
  OperatorCommandError,
  OperatorCommandResult,
  OperatorCommandStatus,
  OperatorCommandTarget,
  OperatorEnvelopeError,
  OperatorEnvelopeErrorCode,
  OperatorEventRef,
  OperatorSurface,
  OsUserOperatorActorRef,
  PreviewRunParams,
  PreviewRunView,
  RunInspectionView,
  RunStartedView,
  StartRunParams,
  UnavailableOsUserOperatorActorRef,
} from 'sdk';
import { describe, expect, it } from 'vitest';

import {
  deferredExternalTriggerActorFixture,
  inspectRunParamsFixture,
  operatorActionRecordedPayloadFixture,
  operatorCommandEnvelopeFixture,
  operatorCommandErrorFixture,
  operatorCommandResultFixture,
  operatorCommandTargetFixture,
  operatorEnvelopeErrorFixture,
  operatorEventRefFixture,
  osUserOperatorActorFixture,
  previewRunParamsFixture,
  previewRunViewFixture,
  runInspectionViewFixture,
  runStartedViewFixture,
  startRunParamsFixture,
  unavailableOsUserOperatorActorFixture,
} from './public-import-support.js';

describe('edge-01-s1 public sdk imports', () => {
  it('imports the operator command substrate from the sdk entrypoint', () => {
    const surface: OperatorSurface = 'cli';
    const actionKind: OperatorActionKind = 'preview-run';
    const actor: OperatorActorRef = osUserOperatorActorFixture;
    const osUserActor: OsUserOperatorActorRef = osUserOperatorActorFixture;
    const unavailableActor: UnavailableOsUserOperatorActorRef = unavailableOsUserOperatorActorFixture;
    const externalActor: DeferredExternalTriggerActorRef = deferredExternalTriggerActorFixture;
    const target: OperatorCommandTarget = operatorCommandTargetFixture;
    const envelopeErrorCode: OperatorEnvelopeErrorCode = 'params-invalid';
    const envelopeError: OperatorEnvelopeError = operatorEnvelopeErrorFixture;
    const status: OperatorCommandStatus = 'completed';
    const eventRef: OperatorEventRef = operatorEventRefFixture;
    const commandError: OperatorCommandError = operatorCommandErrorFixture;
    const previewParams: PreviewRunParams = previewRunParamsFixture;
    const previewView: PreviewRunView = previewRunViewFixture;
    const startParams: StartRunParams = startRunParamsFixture;
    const startView: RunStartedView = runStartedViewFixture;
    const inspectParams: InspectRunParams = inspectRunParamsFixture;
    const inspectView: RunInspectionView = runInspectionViewFixture;
    const envelope: OperatorCommandEnvelope<PreviewRunParams> = operatorCommandEnvelopeFixture;
    const result: OperatorCommandResult<PreviewRunView> = operatorCommandResultFixture;
    const auditPayload: OperatorActionRecordedPayload = operatorActionRecordedPayloadFixture;

    expect(surface).toBe('cli');
    expect(actionKind).toBe('preview-run');
    expect(actor).toEqual(osUserActor);
    expect(unavailableActor.kind).toBe('os-user-unavailable');
    expect(externalActor.kind).toBe('external-trigger');
    expect(target.runId).toBe('run-123');
    expect(envelopeErrorCode).toBe('params-invalid');
    expect(envelopeError.field).toBe('params.taskIds');
    expect(status).toBe('completed');
    expect(eventRef.type).toBe('OperatorActionRecorded');
    expect(commandError.evidenceRefs).toHaveLength(1);
    expect(previewParams.dryRun).toBe(true);
    expect(previewView.candidateCount).toBe(1);
    expect(startParams.selection.mode).toBe('task');
    expect(startView.queued).toBe(false);
    expect(inspectParams.viewSelectors).toHaveLength(5);
    expect(inspectView.includedViews).toHaveLength(5);
    expect(envelope.commandName).toBe('workflow run preview');
    expect(result.view).toEqual(previewView);
    expect(auditPayload.resultIntent).toBe('read');
  });
});
