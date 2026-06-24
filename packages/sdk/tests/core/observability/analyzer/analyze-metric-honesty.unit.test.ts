import { describe, expect, it } from 'vitest';

import { analyze } from '../../../../src/core/observability/analyzer/index.js';

import { createProjections, createRequest, createSnapshot, isAnalysisFailure } from './shared.js';

describe('core-07-s2 analyze metric honesty', () => {
  it('marks absent source evidence as unavailable instead of coercing a metric value', () => {
    const snapshot = createSnapshot({
      projections: createProjections({
        metrics: {
          eventCount: 1,
          retryCount: 0,
          parkedMs: 0,
          firstRecordedAt: undefined,
          lastRecordedAt: undefined,
        },
      }),
    });

    const outcome = analyze(createRequest(), snapshot);

    expect(isAnalysisFailure(outcome)).toBe(false);
    if (isAnalysisFailure(outcome)) {
      throw new Error('expected analysis result');
    }

    expect(outcome.metrics['last-recorded-at']?.state).toBe('unavailable');
  });
});
