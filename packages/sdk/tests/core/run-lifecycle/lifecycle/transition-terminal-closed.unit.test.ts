import { describe, expect, it } from 'vitest';

import { validateLifecycleTransition } from '../../../../src/core/run-lifecycle/lifecycle/index.js';
import { postTerminalTransitionFixtures } from './post-terminal-transition.fixture.js';

describe('core-01-s3 terminal closure', () => {
  it('rejects any outgoing transition from a terminal lifecycle state', () => {
    for (const { from, payload } of postTerminalTransitionFixtures) {
      expect(validateLifecycleTransition(from, payload)).toEqual({
        ok: false,
        error: 'illegal-lifecycle-transition',
      });
    }
  });
});
