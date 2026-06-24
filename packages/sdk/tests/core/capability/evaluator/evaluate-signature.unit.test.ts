import { afterEach, describe, expect, it, vi } from 'vitest';

import { evaluateCapabilityGate } from '../../../../src/core/capability/evaluator/index.js';

import { allowAutoMergeFixture } from './fixtures/allow-auto-merge.fixture.js';

describe('core-02-s2 evaluateCapabilityGate signature and purity', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns deep-equal payloads for identical inputs and avoids Date.now', () => {
    vi.spyOn(Date, 'now').mockReturnValue(100);
    const first = evaluateCapabilityGate(
      allowAutoMergeFixture.request,
      allowAutoMergeFixture.replay,
      allowAutoMergeFixture.projections,
    );

    vi.spyOn(Date, 'now').mockReturnValue(200);
    const second = evaluateCapabilityGate(
      allowAutoMergeFixture.request,
      allowAutoMergeFixture.replay,
      allowAutoMergeFixture.projections,
    );

    expect(first).toEqual(second);
  });
});
