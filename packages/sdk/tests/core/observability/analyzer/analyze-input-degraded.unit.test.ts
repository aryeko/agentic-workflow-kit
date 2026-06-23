import { describe, expect, it } from 'vitest';

import { analyze } from '../../../../src/core/observability/analyzer/index.js';

import { createReplay, createRequest, createSnapshot, isAnalysisFailure } from './shared.js';

describe('core-07-s2 analyze degraded replay input', () => {
  it('returns analysis-input-degraded for interior-corrupt and event-log-unavailable replay health', () => {
    for (const health of ['interior-corrupt', 'event-log-unavailable'] as const) {
      const snapshot = createSnapshot({
        replay: createReplay({
          health,
        }),
      });

      const outcome = analyze(createRequest(), snapshot);

      expect(isAnalysisFailure(outcome)).toBe(true);
      if (!isAnalysisFailure(outcome)) {
        throw new Error('expected analysis failure');
      }

      expect(outcome.reason).toBe('analysis-input-degraded');
    }
  });
});
