import { describe, expect, it } from 'vitest';

import type { MetricValue, TelemetryTopic } from '../../../../src/index.js';
import { TELEMETRY_TOPIC_CATALOG } from '../../../../src/index.js';

import { evidenceEventRefFixture } from './shared.js';

describe('core-07-s1 public telemetry barrel imports', () => {
  it('imports telemetry types and catalog from the sdk source entrypoint barrel', () => {
    const topic: TelemetryTopic = 'analysis';
    const metric: MetricValue<number> = {
      state: 'available',
      value: 1,
      unit: 'count',
      evidenceRefs: [evidenceEventRefFixture],
    };

    expect(typeof TELEMETRY_TOPIC_CATALOG).toBe('object');
    expect(TELEMETRY_TOPIC_CATALOG).toHaveLength(10);
    expect(topic).toBe('analysis');
    expect(metric.value).toBe(1);
  });
});
