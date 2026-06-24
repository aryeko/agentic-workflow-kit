import { describe, expect, it } from 'vitest';

import type { MetricValue } from '../../../../src/core/observability/telemetry/index.js';

describe('core-07-s1 partial metric values', () => {
  it('constructs the partial arm with an explicit missing source list', () => {
    const metric: MetricValue<number> = {
      state: 'partial',
      value: undefined,
      unit: 'count',
      missing: ['tool-exit-counts'],
      evidenceRefs: [],
    };

    expect(metric.state).toBe('partial');
    expect(metric.missing[0]).toBe('tool-exit-counts');
    expect(metric.evidenceRefs).toEqual([]);
  });
});
