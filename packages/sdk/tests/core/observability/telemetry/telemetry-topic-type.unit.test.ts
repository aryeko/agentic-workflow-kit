import { describe, expect, it } from 'vitest';

import { TELEMETRY_TOPIC_CATALOG } from '../../../../src/core/observability/telemetry/index.js';

import { expectedTelemetryTopics } from './shared.js';

describe('core-07-s1 telemetry topic type', () => {
  it('exposes the exact topic labels in catalog order', () => {
    expect(TELEMETRY_TOPIC_CATALOG.map((entry) => entry.topic)).toEqual(expectedTelemetryTopics);
  });
});
