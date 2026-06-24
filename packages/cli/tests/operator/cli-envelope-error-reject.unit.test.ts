import { describe, expect, it } from 'vitest';

import { invokePreviewRun } from '../../src/operator-smoke/preview-run.js';

import {
  buildClock,
  buildControlSurface,
  buildIdentityResolver,
  buildIds,
  operatorCommandErrorFixture,
  previewEnvelopeErrorFixture,
  previewParamsFixture,
  targetFixture,
} from './support.js';

describe('edge-01-s2 CLI envelope error reject path', () => {
  it('forwards the error-bearing envelope once and returns a rejected result', () => {
    const controlSurface = buildControlSurface();
    const resolveIdentity = buildIdentityResolver();

    controlSurface.setResult('preview-run', {
      schema: 'kit-vnext.operator-command-result.v1',
      actionId: 'action-001',
      status: 'rejected',
      errors: [operatorCommandErrorFixture()],
    });

    const result = invokePreviewRun(
      previewParamsFixture,
      targetFixture,
      {
        controlSurface,
        resolveIdentity: resolveIdentity.resolve,
        clock: buildClock().now,
        ids: buildIds().nextId,
      },
      [previewEnvelopeErrorFixture],
    );

    expect(controlSurface.callsFor('preview-run')).toHaveLength(1);
    expect(controlSurface.callsFor('preview-run')[0]?.envelope.envelopeErrors).toEqual([previewEnvelopeErrorFixture]);
    expect(result.status).toBe('rejected');
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
