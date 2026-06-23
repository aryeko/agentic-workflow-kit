import type {
  RunLaunchProjection,
  RunMetricsProjection,
  RunProjections,
  RunStateProjection,
  RunSummaryProjection,
} from 'sdk';
import { describe, expect, it } from 'vitest';

import { project } from '../../../../src/index.js';

import { makeProjectionFixture } from './test-support.js';

describe('core-01-s5 public sdk projection imports', () => {
  it('exports project and the projection types from the sdk entrypoint', () => {
    const projections: RunProjections = makeProjectionFixture();
    const state: RunStateProjection = projections.state;
    const summary: RunSummaryProjection = projections.summary;
    const metrics: RunMetricsProjection = projections.metrics;
    const launch: RunLaunchProjection = projections.launch;

    expect(project).toBeTypeOf('function');
    expect(state.lifecycle).toBe(summary.status);
    expect(metrics.eventCount).toBeGreaterThan(0);
    expect(launch.linkHistory).toHaveLength(1);
  });
});
