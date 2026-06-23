import { describe, expect, it } from 'vitest';

import {
  LIFECYCLE_LEGAL_EDGE_CATALOG,
  TERMINAL_LIFECYCLE_STATE_SET,
} from '../../../../src/core/run-lifecycle/lifecycle/index.js';

describe('core-01-s3 terminal vocabulary', () => {
  it('exports the exact terminal-state set and no abandoned target', () => {
    expect(TERMINAL_LIFECYCLE_STATE_SET).toEqual(['completed', 'blocked', 'failed', 'canceled']);
    expect(LIFECYCLE_LEGAL_EDGE_CATALOG.some((edge) => edge.to === 'abandoned')).toBe(false);
  });
});
