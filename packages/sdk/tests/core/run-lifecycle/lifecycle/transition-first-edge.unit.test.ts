import { describe, expect, it } from 'vitest';

import { validateLifecycleTransition } from '../../../../src/core/run-lifecycle/lifecycle/index.js';
import { firstTransitionWrongTargetFixture } from './first-transition-wrong-target.fixture.js';
import { makeTransitionPayload } from './fixtures.js';

describe('core-01-s3 first lifecycle edge', () => {
  it('rejects a first transition that does not target created', () => {
    expect(validateLifecycleTransition(null, firstTransitionWrongTargetFixture)).toEqual({
      ok: false,
      error: 'illegal-lifecycle-transition',
    });
  });

  it('rejects a created transition without any source reference', () => {
    expect(
      validateLifecycleTransition(null, makeTransitionPayload({ from: null, to: 'created', sourceEventIds: [] })),
    ).toEqual({
      ok: false,
      error: 'illegal-lifecycle-transition',
    });
  });
});
