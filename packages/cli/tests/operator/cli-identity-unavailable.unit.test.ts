import { describe, expect, it } from 'vitest';
import { FakeOsIdentityResolver } from '../../../testkit/src/index.js';
import { invokePreviewRun } from '../../src/operator-smoke/preview-run.js';
import {
  buildClock,
  buildControlSurface,
  buildIds,
  previewParamsFixture,
  targetFixture,
  unavailableActorFixture,
} from './support.js';

describe('edge-01-s2 CLI identity unavailable path', () => {
  it('forwards an os-user-unavailable actor and still calls the fake once', () => {
    const controlSurface = buildControlSurface();
    const resolveIdentity = new FakeOsIdentityResolver(unavailableActorFixture);

    invokePreviewRun(previewParamsFixture, targetFixture, {
      controlSurface,
      resolveIdentity: resolveIdentity.resolve,
      clock: buildClock().now,
      ids: buildIds().nextId,
    });

    expect(controlSurface.callsFor('preview-run')).toHaveLength(1);
    expect(controlSurface.callsFor('preview-run')[0]?.envelope.actor.kind).toBe('os-user-unavailable');
  });
});
