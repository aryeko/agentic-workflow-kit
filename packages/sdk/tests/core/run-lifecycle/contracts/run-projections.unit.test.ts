import { describe, expect, it } from 'vitest';

import type {
  RunLaunchProjection,
  RunMetricsProjection,
  RunProjections,
  RunStateProjection,
  RunSummaryProjection,
} from '../../../../src/index.js';

import {
  runLaunchProjectionFixture,
  runMetricsProjectionFixture,
  runProjectionsFixture,
  runStateProjectionFixture,
  runSummaryProjectionFixture,
} from './fixtures.js';

describe('core-01-s1 run projections', () => {
  it('constructs the projection aggregate and each projection fixture', () => {
    const projections: RunProjections = runProjectionsFixture;
    const state: RunStateProjection = runStateProjectionFixture;
    const summary: RunSummaryProjection = runSummaryProjectionFixture;
    const metrics: RunMetricsProjection = runMetricsProjectionFixture;
    const launch: RunLaunchProjection = runLaunchProjectionFixture;

    expect(projections.state).toEqual(state);
    expect(summary.unknownEvents).toEqual([]);
    expect(metrics.eventCount).toBe(4);
    expect(launch.linkage).toBe('known');
  });
});
