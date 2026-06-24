import { describe, expect, it } from 'vitest';

import type {
  InspectRunParams,
  PreviewRunParams,
  PreviewRunView,
  RunInspectionView,
  RunStartedView,
  StartRunParams,
} from '../../../src/edge/operator-command/index.js';
import {
  inspectRunParamsFixture,
  previewRunParamsFixture,
  previewRunViewFixture,
  runInspectionViewFixture,
  runStartedViewFixture,
  startRunNextEligibleParamsFixture,
  startRunParamsFixture,
} from './fixtures.js';

describe('edge-01-s1 operator params and views', () => {
  it('constructs the preview, start, and inspect param/view pairs', () => {
    const previewParams: PreviewRunParams = previewRunParamsFixture;
    const previewView: PreviewRunView = previewRunViewFixture;
    const startParams: StartRunParams = startRunParamsFixture;
    const nextEligibleStartParams: StartRunParams = startRunNextEligibleParamsFixture;
    const startView: RunStartedView = runStartedViewFixture;
    const inspectParams: InspectRunParams = inspectRunParamsFixture;
    const inspectView: RunInspectionView = runInspectionViewFixture;

    expect(previewParams.dryRun).toBe(true);
    expect(previewView.candidateCount).toBe(1);
    expect(startParams.selection.mode).toBe('task');
    expect(nextEligibleStartParams.selection.mode).toBe('next-eligible');
    expect(startView.selection.mode).toBe('task');
    expect(inspectParams.viewSelectors).toEqual(['state', 'events', 'approvals', 'gates', 'analysis']);
    expect(inspectView.analysis?.reportRefs).toEqual(['artifact://analysis-1']);
  });
});
