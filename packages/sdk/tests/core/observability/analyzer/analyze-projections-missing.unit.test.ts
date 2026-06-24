import { describe, expect, it } from 'vitest';

import { analyze } from '../../../../src/core/observability/analyzer/index.js';

import { createRequest, createSnapshot, isAnalysisFailure } from './shared.js';

describe('core-07-s2 analyze missing projections', () => {
  it('returns analysis-input-degraded when projections are absent', () => {
    const snapshot = {
      ...createSnapshot(),
      projections: undefined,
    } as unknown;

    const outcome = analyze(createRequest(), snapshot as never);

    expect(isAnalysisFailure(outcome)).toBe(true);
    if (!isAnalysisFailure(outcome)) {
      throw new Error('expected analysis failure');
    }

    expect(outcome.reason).toBe('analysis-input-degraded');
  });
});
