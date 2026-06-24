import { describe, expect, it } from 'vitest';
import { analyzeWithRuleSet } from '../../../../src/core/observability/analyzer/analyze.js';
import type { AnalysisIssue } from '../../../../src/core/observability/analyzer/index.js';

import { artifactRefFixture, createRequest, createSnapshot, createTrigger, isAnalysisFailure } from './shared.js';

describe('core-07-s2 analyze rule failures', () => {
  it('returns analysis-rule-error for throwing and malformed rules without leaking raw error text', () => {
    const request = createRequest();
    const snapshot = createSnapshot();

    const throwingResult = analyzeWithRuleSet(request, snapshot, [
      () => {
        throw new Error('top-secret provider failure text');
      },
    ]);
    const malformedResult = analyzeWithRuleSet(request, snapshot, [
      () =>
        [
          {
            code: 'malformed-issue',
            severity: 'info',
            evidenceRefs: [],
            artifactRefs: [],
            metricRefs: [],
          },
        ] as AnalysisIssue[],
    ]);

    for (const outcome of [throwingResult, malformedResult]) {
      expect(isAnalysisFailure(outcome)).toBe(true);
      if (!isAnalysisFailure(outcome)) {
        throw new Error('expected analysis failure');
      }

      expect(outcome.reason).toBe('analysis-rule-error');
      expect(JSON.stringify(outcome)).not.toContain('top-secret provider failure text');
    }
  });

  it('returns analysis-rule-error for non-array rule output', () => {
    const result = analyzeWithRuleSet(createRequest(), createSnapshot(), [
      () => ({ code: 'not-an-array' }) as unknown as AnalysisIssue[],
    ]);

    expect(isAnalysisFailure(result)).toBe(true);
    if (!isAnalysisFailure(result)) {
      throw new Error('expected analysis failure');
    }

    expect(result.reason).toBe('analysis-rule-error');
  });

  it.each([
    {
      label: 'null issue',
      issue: null,
    },
    {
      label: 'non-object issue',
      issue: 'bad-issue',
    },
    {
      label: 'null evidence ref',
      issue: {
        code: 'bad-evidence',
        severity: 'info',
        summary: 'bad evidence',
        evidenceRefs: [null],
        artifactRefs: [],
        metricRefs: [],
      },
    },
    {
      label: 'bad evidence ref',
      issue: {
        code: 'bad-evidence',
        severity: 'info',
        summary: 'bad evidence',
        evidenceRefs: [{ eventId: 'evt-1', sequence: '1', payloadDigest: 'sha256:1', type: 'RunCreated' }],
        artifactRefs: [],
        metricRefs: [],
      },
    },
    {
      label: 'null artifact ref',
      issue: {
        code: 'bad-artifact',
        severity: 'info',
        summary: 'bad artifact',
        evidenceRefs: [createTrigger('terminal-lifecycle').eventRef],
        artifactRefs: [null],
        metricRefs: [],
      },
    },
    {
      label: 'bad artifact ref',
      issue: {
        code: 'bad-artifact',
        severity: 'info',
        summary: 'bad artifact',
        evidenceRefs: [createTrigger('terminal-lifecycle').eventRef],
        artifactRefs: [{ ...artifactRefFixture, size: '32' }],
        metricRefs: [],
      },
    },
    {
      label: 'bad metric ref',
      issue: {
        code: 'bad-metric-ref',
        severity: 'info',
        summary: 'bad metric ref',
        evidenceRefs: [createTrigger('terminal-lifecycle').eventRef],
        artifactRefs: [],
        metricRefs: [123],
      },
    },
  ])('returns analysis-rule-error for malformed rule issue: $label', ({ issue }) => {
    const result = analyzeWithRuleSet(createRequest(), createSnapshot(), [() => [issue] as unknown as AnalysisIssue[]]);

    expect(isAnalysisFailure(result)).toBe(true);
    if (!isAnalysisFailure(result)) {
      throw new Error('expected analysis failure');
    }

    expect(result.reason).toBe('analysis-rule-error');
  });
});
