import { describe, expect, it } from 'vitest';

import type {
  AnalysisFailure,
  AnalysisInputHealth,
  AnalysisIssue,
  AnalysisOutcome,
  AnalysisRequest,
  AnalysisResult,
  AnalysisSnapshot,
  AnalysisTrigger,
  AnalysisTriggerKind,
} from '../../../../src/core/observability/analyzer/index.js';

import { artifactRefFixture, createRequest, createSnapshot, createTrigger } from './shared.js';

describe('core-07-s2 analyzer types', () => {
  it('constructs each analyzer type shape, including both analysis outcome arms', () => {
    const triggerKind: AnalysisTriggerKind = 'terminal-lifecycle';
    const trigger: AnalysisTrigger = createTrigger(triggerKind);
    const request: AnalysisRequest = createRequest({ trigger });
    const snapshot: AnalysisSnapshot = createSnapshot();
    const inputHealth: AnalysisInputHealth = {
      replayHealth: 'ok',
      projections: 'available',
      artifactInputs: 'available',
      redaction: 'applied',
    };
    const issue: AnalysisIssue = {
      issueId: 'issue-1',
      code: 'metric-unavailable',
      severity: 'info',
      summary: 'last recorded at is unavailable',
      evidenceRefs: [trigger.eventRef],
      artifactRefs: [artifactRefFixture],
      metricRefs: ['last-recorded-at'],
    };
    const result: AnalysisResult = {
      issues: [issue],
      metrics: {
        'last-recorded-at': {
          state: 'unavailable',
          reason: 'missing source evidence',
          evidenceRefs: [trigger.eventRef],
        },
      },
      evidenceRefs: [trigger.eventRef],
    };
    const failure: AnalysisFailure = {
      reason: 'analysis-input-degraded',
      evidenceRefs: [trigger.eventRef],
      artifactRefs: [artifactRefFixture],
    };
    const recordedOutcome: AnalysisOutcome = {
      kind: 'recorded',
      result,
    };
    const failedOutcome: AnalysisOutcome = {
      kind: 'failed',
      failure,
    };

    expect(request.trigger.kind).toBe('terminal-lifecycle');
    expect(snapshot.redactedArtifacts.primary).toEqual(artifactRefFixture);
    expect(inputHealth.projections).toBe('available');
    expect(issue.severity).toBe('info');
    expect(recordedOutcome.kind).toBe('recorded');
    expect(failedOutcome.kind).toBe('failed');
  });
});
