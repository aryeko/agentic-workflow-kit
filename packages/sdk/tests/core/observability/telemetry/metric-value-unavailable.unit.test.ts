import { describe, expect, it } from 'vitest';

import type { MetricValue } from '../../../../src/core/observability/telemetry/index.js';

describe('core-07-s1 unavailable metric values', () => {
  it('constructs the unavailable arm with a required reason', () => {
    const metric: MetricValue<number> = {
      state: 'unavailable',
      reason: 'post-merge-outcome-absent',
      evidenceRefs: [],
    };

    expect(metric.state).toBe('unavailable');
    expect(metric.reason).toBe('post-merge-outcome-absent');
    expect(metric.evidenceRefs).toEqual([]);
  });
});
