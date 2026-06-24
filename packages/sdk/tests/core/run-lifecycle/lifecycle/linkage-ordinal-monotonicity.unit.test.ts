import { describe, expect, it } from 'vitest';

import { hasContiguousSessionLinkOrdinals } from '../../../../src/core/run-lifecycle/lifecycle/index.js';
import { makeSessionLinkedPayload } from './fixtures.js';
import { linkageOrdinalViolationFixtures } from './linkage-ordinal-violations.fixture.js';

describe('core-01-s3 session-link ordinal monotonicity', () => {
  it('accepts contiguous sequences and rejects gaps, duplicates, non-1 starts, and decreases', () => {
    expect(
      hasContiguousSessionLinkOrdinals([
        makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-1' }),
        makeSessionLinkedPayload({ linkOrdinal: 2, sessionId: 'session-2' }),
        makeSessionLinkedPayload({ linkOrdinal: 3, sessionId: 'session-3' }),
      ]),
    ).toBe(true);

    for (const fixture of linkageOrdinalViolationFixtures) {
      expect(hasContiguousSessionLinkOrdinals(fixture.links), fixture.name).toBe(false);
    }
  });
});
