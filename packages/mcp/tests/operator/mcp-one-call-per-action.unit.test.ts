import { describe, expect, it } from 'vitest';
import {
  buildClock,
  buildControlSurface,
  buildIdentityResolver,
  buildIds,
  inspectParamsFixture,
  previewParamsFixture,
  startParamsFixture,
  targetFixture,
} from '../../../cli/tests/operator/support.js';
import { invokeInspectRun } from '../../src/operator-smoke/inspect-run.js';
import { invokePreviewRun } from '../../src/operator-smoke/preview-run.js';
import { invokeStartRun } from '../../src/operator-smoke/start-run.js';

describe('edge-01-s2 MCP one-call-per-action', () => {
  it('calls the fake control surface exactly once per action', () => {
    const controlSurface = buildControlSurface();
    const resolveIdentity = buildIdentityResolver();

    invokePreviewRun(previewParamsFixture, targetFixture, {
      controlSurface,
      resolveIdentity: resolveIdentity.resolve,
      clock: buildClock().now,
      ids: buildIds().nextId,
    });
    invokeStartRun(startParamsFixture, targetFixture, {
      controlSurface,
      resolveIdentity: resolveIdentity.resolve,
      clock: buildClock().now,
      ids: buildIds().nextId,
    });
    invokeInspectRun(inspectParamsFixture, targetFixture, {
      controlSurface,
      resolveIdentity: resolveIdentity.resolve,
      clock: buildClock().now,
      ids: buildIds().nextId,
    });

    expect(controlSurface.callsFor('preview-run')).toHaveLength(1);
    expect(controlSurface.callsFor('start-run')).toHaveLength(1);
    expect(controlSurface.callsFor('inspect-run')).toHaveLength(1);
  });
});
