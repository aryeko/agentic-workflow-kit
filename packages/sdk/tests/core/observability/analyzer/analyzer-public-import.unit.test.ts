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
} from 'sdk';
import { analyze, classifyTrigger } from 'sdk';
import { describe, expect, it } from 'vitest';

import {
  createLifecycleTransitionEvent,
  createProjections,
  createRequest,
  createSnapshot,
  createTrigger,
} from './shared.js';

describe('core-07-s2 public analyzer imports', () => {
  it('imports analyzer functions and public types from the sdk entrypoint', () => {
    const event = createLifecycleTransitionEvent('evt-public', 90, 'completed');
    const triggerFromEvent = classifyTrigger(event, createProjections());
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
      issueId: 'public-issue',
      code: 'metric-unavailable',
      severity: 'info',
      summary: 'metric unavailable',
      evidenceRefs: [trigger.eventRef],
      artifactRefs: [],
      metricRefs: ['last-recorded-at'],
    };
    const outcome = analyze(request, snapshot);
    const result: AnalysisResult = {
      issues: [issue],
      metrics: {},
      evidenceRefs: [trigger.eventRef],
    };
    const failure: AnalysisFailure = {
      reason: 'analysis-input-degraded',
      evidenceRefs: [trigger.eventRef],
      artifactRefs: [],
    };
    const recorded: AnalysisOutcome = {
      kind: 'recorded',
      result,
    };
    const failed: AnalysisOutcome = {
      kind: 'failed',
      failure,
    };

    expect(triggerFromEvent?.kind).toBe('terminal-lifecycle');
    expect(inputHealth.redaction).toBe('applied');
    expect(issue.code).toBe('metric-unavailable');
    expect(outcome).toBeDefined();
    expect(recorded.kind).toBe('recorded');
    expect(failed.kind).toBe('failed');
  });
});
