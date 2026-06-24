import { describe, expect, it } from 'vitest';

import { checkTerminalAnalysisInvariant } from '../../../../src/core/observability/records/index.js';

import {
  createEvent,
  createRecordInput,
  createReplay,
  createTerminalEvent,
  redactedReportRef,
  scratchReportRef,
} from './shared.js';

const toEventRef = (event: ReturnType<typeof createTerminalEvent>) => ({
  eventId: event.eventId,
  sequence: event.sequence,
  payloadDigest: event.payloadDigest,
  type: event.type,
});

describe('core-07-s3 terminal analysis invariant', () => {
  it('reports terminal usable replay with no analysis fact as analysis-invariant-missing', () => {
    const result = checkTerminalAnalysisInvariant(createReplay([createTerminalEvent()]));

    expect(result).toMatchObject({
      status: 'unmet',
      reason: 'analysis-invariant-missing',
    });
  });

  it('does not report corrupt replay as satisfied', () => {
    const result = checkTerminalAnalysisInvariant(createReplay([createTerminalEvent()], 'interior-corrupt'));

    expect(result).toMatchObject({
      status: 'unmet',
      reason: 'analysis-record-unwritable',
    });
  });

  it('treats blocked lifecycle transitions as terminal without the optional terminal flag', () => {
    const result = checkTerminalAnalysisInvariant(
      createReplay([
        createEvent({
          eventId: 'blocked-transition',
          sequence: 10,
          type: 'RunLifecycleTransitioned',
          payload: {
            from: 'running',
            to: 'blocked',
            reason: 'blocked',
            authority: 'system',
            sourceEventIds: ['source-event'],
          },
        }),
      ]),
    );

    expect(result).toMatchObject({
      status: 'unmet',
      reason: 'analysis-invariant-missing',
    });
  });

  it('ignores terminal flags on non-terminal lifecycle states', () => {
    const result = checkTerminalAnalysisInvariant(
      createReplay([
        createEvent({
          eventId: 'running-transition',
          sequence: 10,
          type: 'RunLifecycleTransitioned',
          payload: {
            from: 'worker-starting',
            to: 'running',
            reason: 'running',
            authority: 'system',
            sourceEventIds: ['source-event'],
            terminal: true,
          },
        }),
      ]),
    );

    expect(result).toEqual({ status: 'not-terminal' });
  });

  it('reports satisfied only when an analysis fact exists at or after the terminal sequence', () => {
    const terminalEvent = createTerminalEvent(10);
    const baseInput = createRecordInput();
    const input = createRecordInput({
      request: {
        ...baseInput.request,
        trigger: {
          ...baseInput.request.trigger,
          eventRef: toEventRef(terminalEvent),
        },
      },
    });
    const payload = {
      schema: 'kit-vnext.analysis-recorded.v1' as const,
      request: input.request,
      inputHealth: input.inputHealth,
      issues: [],
      metrics: {},
      evidenceRefs: [],
      reportArtifactRef: redactedReportRef,
    };
    const result = checkTerminalAnalysisInvariant(
      createReplay([
        terminalEvent,
        createEvent({
          eventId: 'analysis:after-terminal',
          sequence: 11,
          type: 'AnalysisRecorded',
          payload,
        }),
      ]),
    );

    expect(result.status).toBe('satisfied');
  });

  it('ignores later analysis facts recorded for a different trigger', () => {
    const input = createRecordInput();
    const staleProgressInput = createRecordInput({
      request: {
        ...input.request,
        trigger: {
          kind: 'stale-progress',
          eventRef: {
            eventId: 'evt-progress-9',
            sequence: 9,
            payloadDigest: 'sha256:progress',
            type: 'ProgressObserved',
          },
          reason: 'stale progress',
        },
        evaluatedThrough: {
          runId: input.request.runId,
          afterSequence: 11,
        },
      },
    });
    const payload = {
      schema: 'kit-vnext.analysis-recorded.v1' as const,
      request: staleProgressInput.request,
      inputHealth: staleProgressInput.inputHealth,
      issues: [],
      metrics: {},
      evidenceRefs: [],
      reportArtifactRef: redactedReportRef,
    };

    const result = checkTerminalAnalysisInvariant(
      createReplay([
        createTerminalEvent(10),
        createEvent({
          eventId: 'analysis:stale-progress',
          sequence: 11,
          type: 'AnalysisRecorded',
          payload,
        }),
      ]),
    );

    expect(result).toMatchObject({
      status: 'unmet',
      reason: 'analysis-invariant-missing',
    });
  });

  it('ignores terminal-triggered analysis that did not evaluate through the terminal event', () => {
    const terminalEvent = createTerminalEvent(10);
    const baseInput = createRecordInput();
    const input = createRecordInput({
      request: {
        ...baseInput.request,
        trigger: {
          ...baseInput.request.trigger,
          eventRef: toEventRef(terminalEvent),
        },
        evaluatedThrough: {
          runId: baseInput.request.runId,
          afterSequence: 9,
        },
      },
    });
    const payload = {
      schema: 'kit-vnext.analysis-failed.v1' as const,
      request: input.request,
      inputHealth: input.inputHealth,
      reason: 'analysis-rule-error',
      evidenceRefs: [],
      artifactRefs: [],
    };

    const result = checkTerminalAnalysisInvariant(
      createReplay([
        terminalEvent,
        createEvent({
          eventId: 'analysis:too-early-cursor',
          sequence: 11,
          type: 'AnalysisFailed',
          payload,
        }),
      ]),
    );

    expect(result).toMatchObject({
      status: 'unmet',
      reason: 'analysis-invariant-missing',
    });
  });

  it('ignores malformed and scratch analysis payloads after the terminal sequence', () => {
    const input = createRecordInput();
    const refWithoutRetentionClass = { ...redactedReportRef };
    delete (refWithoutRetentionClass as Partial<typeof redactedReportRef>).retentionClass;
    const result = checkTerminalAnalysisInvariant(
      createReplay([
        createTerminalEvent(10),
        createEvent({
          eventId: 'analysis:malformed',
          sequence: 11,
          type: 'AnalysisFailed',
          payload: {
            schema: 'kit-vnext.analysis-failed.v1',
          },
        }),
        createEvent({
          eventId: 'analysis:scratch',
          sequence: 12,
          type: 'AnalysisRecorded',
          payload: {
            schema: 'kit-vnext.analysis-recorded.v1' as const,
            request: input.request,
            inputHealth: input.inputHealth,
            issues: [],
            metrics: {},
            evidenceRefs: [],
            reportArtifactRef: scratchReportRef,
          },
        }),
        createEvent({
          eventId: 'analysis:missing-retention',
          sequence: 13,
          type: 'AnalysisRecorded',
          payload: {
            schema: 'kit-vnext.analysis-recorded.v1' as const,
            request: input.request,
            inputHealth: input.inputHealth,
            issues: [],
            metrics: {},
            evidenceRefs: [],
            reportArtifactRef: refWithoutRetentionClass,
          },
        }),
        createEvent({
          eventId: 'analysis:bad-reason',
          sequence: 14,
          type: 'AnalysisFailed',
          payload: {
            schema: 'kit-vnext.analysis-failed.v1' as const,
            request: input.request,
            inputHealth: input.inputHealth,
            reason: 'analysis-typo',
            evidenceRefs: [],
            artifactRefs: [],
          },
        }),
      ]),
    );

    expect(result).toMatchObject({
      status: 'unmet',
      reason: 'analysis-invariant-missing',
    });
  });
});
