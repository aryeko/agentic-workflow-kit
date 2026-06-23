import { describe, expect, it } from 'vitest';

import { analyzeWithRuleSet } from '../../../../src/core/observability/analyzer/analyze.js';
import { analyze } from '../../../../src/core/observability/analyzer/index.js';

import {
  createEvent,
  createLifecycleTransitionEvent,
  createLivenessStateChangedEvent,
  createLivenessTimerExpiredEvent,
  createRecoveryEvent,
  createReplay,
  createRequest,
  createSnapshot,
  createSupervisionLostEvent,
  isAnalysisFailure,
} from './shared.js';

describe('core-07-s2 analyze issue ordering', () => {
  it('sorts issues by severity, sequence, code, and deterministic issue id', () => {
    const replay = createReplay({
      events: [
        createLifecycleTransitionEvent('evt-blocked', 20, 'blocked'),
        createLivenessStateChangedEvent('evt-stale', 30, 'stale'),
        createRecoveryEvent('evt-recovery-b', 35, 'RecoveryClassified'),
        createRecoveryEvent('evt-recovery-a', 35, 'RecoveryActionApplied'),
        createSupervisionLostEvent('evt-supervision-lost', 50),
      ],
      lastSequence: 50,
    });
    const snapshot = createSnapshot({ replay });
    const request = createRequest();

    const first = analyze(request, snapshot);
    const second = analyze(request, snapshot);

    expect(isAnalysisFailure(first)).toBe(false);
    expect(isAnalysisFailure(second)).toBe(false);
    if (isAnalysisFailure(first) || isAnalysisFailure(second)) {
      throw new Error('expected analysis result');
    }

    expect(first.issues.map((issue) => `${issue.severity}:${issue.code}`)).toEqual([
      'failed:liveness-supervision-lost',
      'blocked:lifecycle-blocked-transition',
      'attention:liveness-stale-progress',
      'info:recovery-action-applied',
      'info:recovery-classified',
    ]);
    expect(first.issues.map((issue) => issue.issueId)).toEqual(second.issues.map((issue) => issue.issueId));
  });

  it('classifies every default rule event variant into stable issue codes', () => {
    const replay = createReplay({
      events: [
        createLivenessTimerExpiredEvent('evt-timer-expired', 10),
        createLivenessStateChangedEvent('evt-stale-state', 11, 'stale'),
        createSupervisionLostEvent('evt-supervision-event', 12),
        createLivenessStateChangedEvent('evt-supervision-state', 13, 'supervision-lost'),
        createRecoveryEvent('evt-recovery-classified', 14, 'RecoveryClassified'),
        createRecoveryEvent('evt-recovery-planned', 15, 'RecoveryActionPlanned'),
        createRecoveryEvent('evt-recovery-applied', 16, 'RecoveryActionApplied'),
        createRecoveryEvent('evt-reconciliation-blocked', 17, 'ReconciliationBlocked'),
        createEvent({ eventId: 'evt-ignored', sequence: 18, type: 'UnrelatedEventObserved', payload: 'ignored' }),
      ],
      lastSequence: 18,
    });

    const result = analyze(createRequest(), createSnapshot({ replay }));

    expect(isAnalysisFailure(result)).toBe(false);
    if (isAnalysisFailure(result)) {
      throw new Error('expected analysis result');
    }

    expect(result.issues.map((issue) => issue.code)).toEqual([
      'liveness-supervision-lost',
      'liveness-supervision-lost',
      'liveness-stale-progress',
      'liveness-stale-progress',
      'recovery-classified',
      'recovery-action-planned',
      'recovery-action-applied',
      'reconciliation-blocked',
    ]);
  });

  it('sorts evidence refs and falls back to deterministic issue id ordering', () => {
    const request = createRequest();
    const snapshot = createSnapshot();
    const result = analyzeWithRuleSet(request, snapshot, [
      () => [
        {
          code: 'same-code',
          severity: 'info',
          summary: 'same code later',
          evidenceRefs: [
            { eventId: 'evt-b', sequence: 20, payloadDigest: 'sha256:b', type: 'TypeA' },
            { eventId: 'evt-a', sequence: 20, payloadDigest: 'sha256:c', type: 'TypeB' },
            { eventId: 'evt-a', sequence: 20, payloadDigest: 'sha256:a', type: 'TypeB' },
            { eventId: 'evt-a', sequence: 20, payloadDigest: 'sha256:a', type: 'TypeA' },
          ],
          artifactRefs: [],
          metricRefs: [],
        },
        {
          code: 'same-code',
          severity: 'info',
          summary: 'same code same sequence',
          evidenceRefs: [{ eventId: 'evt-c', sequence: 20, payloadDigest: 'sha256:c', type: 'TypeC' }],
          artifactRefs: [],
          metricRefs: [],
        },
      ],
    ]);

    expect(isAnalysisFailure(result)).toBe(false);
    if (isAnalysisFailure(result)) {
      throw new Error('expected analysis result');
    }

    expect(result.issues).toHaveLength(2);
    expect(result.issues[0].evidenceRefs).toEqual([
      { eventId: 'evt-a', sequence: 20, payloadDigest: 'sha256:a', type: 'TypeA' },
      { eventId: 'evt-a', sequence: 20, payloadDigest: 'sha256:a', type: 'TypeB' },
      { eventId: 'evt-a', sequence: 20, payloadDigest: 'sha256:c', type: 'TypeB' },
      { eventId: 'evt-b', sequence: 20, payloadDigest: 'sha256:b', type: 'TypeA' },
    ]);
  });
});
