import { describe, expect, it } from 'vitest';

import { TELEMETRY_TOPIC_CATALOG } from '../../../../src/core/observability/telemetry/index.js';

import { expectedTelemetryCatalog } from './shared.js';

describe('core-07-s1 telemetry topic catalog', () => {
  it('contains exactly one entry per telemetry topic', () => {
    expect(TELEMETRY_TOPIC_CATALOG).toHaveLength(10);
  });

  it('maps lifecycle and design-specified topic examples into the canonical catalog', () => {
    const lifecycleEntry = TELEMETRY_TOPIC_CATALOG.find((entry) => entry.topic === 'lifecycle');

    expect(lifecycleEntry?.eventTypeNames).toContain('RunLifecycleTransitioned');
    expect(lifecycleEntry?.eventTypeNames).toContain('SessionLinked');

    for (const [topic, expectedEventTypeNames] of Object.entries(expectedTelemetryCatalog)) {
      const entry = TELEMETRY_TOPIC_CATALOG.find((candidate) => candidate.topic === topic);

      expect(entry, `missing catalog entry for ${topic}`).toBeDefined();

      for (const expectedEventTypeName of expectedEventTypeNames) {
        expect(entry?.eventTypeNames).toContain(expectedEventTypeName);
      }
    }
  });

  it('freezes the catalog and nested event type arrays against mutation', () => {
    expect(Object.isFrozen(TELEMETRY_TOPIC_CATALOG)).toBe(true);

    for (const entry of TELEMETRY_TOPIC_CATALOG) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(Object.isFrozen(entry.eventTypeNames)).toBe(true);
    }

    expect(() => {
      (TELEMETRY_TOPIC_CATALOG as TelemetryMutationTarget[]).push({
        topic: 'analysis',
        eventTypeNames: ['AnalysisRecorded'],
      });
    }).toThrow(TypeError);

    expect(() => {
      (TELEMETRY_TOPIC_CATALOG[0]?.eventTypeNames as string[]).push('MutatedEvent');
    }).toThrow(TypeError);
  });
});

type TelemetryMutationTarget = {
  topic: string;
  eventTypeNames: string[];
};
