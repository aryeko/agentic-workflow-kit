import { describe, expect, it } from 'vitest';

import { resolveSessionLinkage } from '../../../../src/core/run-lifecycle/lifecycle/index.js';
import { makeEventEnvelope, makeSessionLinkedPayload, makeSessionLinkSupersededPayload } from './fixtures.js';

describe('core-01-s3 linkage resolution', () => {
  it('returns the latest non-superseded link while preserving full history', () => {
    const resolved = resolveSessionLinkage([
      makeEventEnvelope(
        'SessionLinked',
        1,
        makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-primary-1' }),
      ),
      makeEventEnvelope(
        'SessionLinked',
        2,
        makeSessionLinkedPayload({ linkOrdinal: 2, sessionId: 'session-primary-2' }),
      ),
      makeEventEnvelope(
        'SessionLinkSuperseded',
        3,
        makeSessionLinkSupersededPayload({
          supersededOrdinal: 1,
          replacementOrdinal: 2,
          reason: 'recovery handoff',
          sourceEventId: 'evt-supersede',
        }),
      ),
    ]);

    expect(resolved.currentSession?.linkOrdinal).toBe(2);
    expect(resolved.linkHistory).toHaveLength(2);
    expect(resolved.linkHistory.some((link) => link.linkOrdinal === 1)).toBe(true);
  });
});
