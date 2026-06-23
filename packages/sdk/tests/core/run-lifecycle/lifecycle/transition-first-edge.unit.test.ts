import { describe, expect, it } from 'vitest';

import { validateLifecycleTransition } from '../../../../src/core/run-lifecycle/lifecycle/index.js';
import { createdMissingRunCreatedRefFixture } from './created-missing-runcreated-ref.fixture.js';
import { firstTransitionWrongTargetFixture } from './first-transition-wrong-target.fixture.js';

describe('core-01-s3 first lifecycle edge', () => {
  it('rejects a first transition that does not target created', () => {
    expect(validateLifecycleTransition(null, firstTransitionWrongTargetFixture)).toEqual({
      ok: false,
      error: 'illegal-lifecycle-transition',
    });
  });

  it('rejects a created transition that does not reference RunCreated', () => {
    expect(validateLifecycleTransition(null, createdMissingRunCreatedRefFixture)).toEqual({
      ok: false,
      error: 'illegal-lifecycle-transition',
    });
  });
});
