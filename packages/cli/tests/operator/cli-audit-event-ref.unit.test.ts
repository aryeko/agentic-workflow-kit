import { describe, expect, it } from 'vitest';

import { invokeInspectRun } from '../../src/operator-smoke/inspect-run.js';
import { invokePreviewRun } from '../../src/operator-smoke/preview-run.js';
import { invokeStartRun } from '../../src/operator-smoke/start-run.js';

import {
  buildClock,
  buildControlSurface,
  buildIdentityResolver,
  buildIds,
  inspectParamsFixture,
  operatorEventRefFixture,
  previewParamsFixture,
  startParamsFixture,
  targetFixture,
} from './support.js';

describe('edge-01-s2 CLI audit event refs', () => {
  it('returns the configured operator audit event ref for each action', () => {
    const controlSurface = buildControlSurface();
    const resolveIdentity = buildIdentityResolver();
    const previewEventRef = operatorEventRefFixture('evt-preview');
    const startEventRef = operatorEventRefFixture('evt-start');
    const inspectEventRef = operatorEventRefFixture('evt-inspect');

    controlSurface.setResult('preview-run', {
      schema: 'kit-vnext.operator-command-result.v1',
      actionId: 'action-001',
      status: 'completed',
      operatorEventRef: previewEventRef,
      errors: [],
    });
    controlSurface.setResult('start-run', {
      schema: 'kit-vnext.operator-command-result.v1',
      actionId: 'action-001',
      status: 'accepted',
      operatorEventRef: startEventRef,
      errors: [],
    });
    controlSurface.setResult('inspect-run', {
      schema: 'kit-vnext.operator-command-result.v1',
      actionId: 'action-001',
      status: 'completed',
      operatorEventRef: inspectEventRef,
      errors: [],
    });

    const previewResult = invokePreviewRun(previewParamsFixture, targetFixture, {
      controlSurface,
      resolveIdentity: resolveIdentity.resolve,
      clock: buildClock().now,
      ids: buildIds().nextId,
    });
    const startResult = invokeStartRun(startParamsFixture, targetFixture, {
      controlSurface,
      resolveIdentity: resolveIdentity.resolve,
      clock: buildClock().now,
      ids: buildIds().nextId,
    });
    const inspectResult = invokeInspectRun(inspectParamsFixture, targetFixture, {
      controlSurface,
      resolveIdentity: resolveIdentity.resolve,
      clock: buildClock().now,
      ids: buildIds().nextId,
    });

    expect(previewResult.operatorEventRef).toEqual(previewEventRef);
    expect(startResult.operatorEventRef).toEqual(startEventRef);
    expect(inspectResult.operatorEventRef).toEqual(inspectEventRef);
  });
});
