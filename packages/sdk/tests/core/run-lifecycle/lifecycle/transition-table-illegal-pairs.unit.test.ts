import { describe, expect, it } from 'vitest';

import { validateLifecycleTransition } from '../../../../src/core/run-lifecycle/lifecycle/index.js';
import { illegalLifecyclePairs } from './transition-illegal-pairs.fixture.js';

describe('core-01-s3 illegal lifecycle edges', () => {
  it('rejects every state-pair that is not in the legal catalog', () => {
    for (const pair of illegalLifecyclePairs) {
      const result = validateLifecycleTransition(pair.from, {
        from: pair.from,
        to: pair.to,
        reason: `${pair.from ?? 'null'} -> ${pair.to}`,
        authority: 'system',
        sourceEventIds: ['Evidence:evt-illegal'],
      });

      expect(result).toEqual({
        ok: false,
        error: 'illegal-lifecycle-transition',
      });
    }
  });
});
