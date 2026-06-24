import { describe, expect, it } from 'vitest';

import type { MetricValue } from '../../../../src/core/observability/telemetry/index.js';

import { evidenceEventRefFixture } from './shared.js';

describe('core-07-s1 available metric values', () => {
  it('constructs the available arm with value, unit, and evidence refs', () => {
    const metric: MetricValue<number> = {
      state: 'available',
      value: 42,
      unit: 'ms',
      evidenceRefs: [evidenceEventRefFixture],
    };

    expect(metric.state).toBe('available');
    expect(metric.value).toBe(42);
    expect(metric.unit).toBe('ms');
    expect(metric.evidenceRefs).toHaveLength(1);
  });
});
