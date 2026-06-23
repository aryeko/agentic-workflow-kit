import type { MetricValue } from '../../../../src/core/observability/telemetry/index.js';

import { evidenceEventRefFixture } from './shared.js';

const availableMetric: MetricValue<number> = {
  state: 'available',
  value: 42,
  unit: 'ms',
  evidenceRefs: [evidenceEventRefFixture],
};

const partialMetricWithEmptyMissing: MetricValue<number> = {
  state: 'partial',
  missing: [],
  unit: 'count',
  evidenceRefs: [],
};

const partialMetricWithMissing: MetricValue<number> = {
  state: 'partial',
  missing: ['tool-exit-counts'],
  unit: 'count',
  evidenceRefs: [],
};

const unavailableMetric: MetricValue<number> = {
  state: 'unavailable',
  reason: 'post-merge-outcome-absent',
  evidenceRefs: [],
};

// @ts-expect-error AC-7 unavailable metrics require reason.
const unavailableWithoutReason: MetricValue<number> = {
  state: 'unavailable',
  evidenceRefs: [],
};

const unavailableWithValue: MetricValue<number> = {
  state: 'unavailable',
  // @ts-expect-error AC-8 unavailable metrics do not admit a value field.
  value: 0,
  reason: 'x',
  evidenceRefs: [],
};

// @ts-expect-error AC-9 available metrics require unit.
const availableWithoutUnit: MetricValue<number> = {
  state: 'available',
  value: 42,
  evidenceRefs: [evidenceEventRefFixture],
};

// @ts-expect-error AC-9 partial metrics require unit.
const partialWithoutUnit: MetricValue<number> = {
  state: 'partial',
  missing: ['tool-exit-counts'],
  evidenceRefs: [],
};

void availableMetric;
void partialMetricWithEmptyMissing;
void partialMetricWithMissing;
void unavailableMetric;
void unavailableWithoutReason;
void unavailableWithValue;
void availableWithoutUnit;
void partialWithoutUnit;
