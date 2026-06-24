import { describe, expect, it } from 'vitest';

import { resolveSessionLinkage } from '../../../../src/core/run-lifecycle/lifecycle/index.js';
import { makeEventEnvelope, makeSessionLinkedPayload } from './fixtures.js';

describe('core-01-s3 linkage classification', () => {
  it('classifies known, unknown, and ambiguous link ownership', () => {
    const known = resolveSessionLinkage([
      makeEventEnvelope(
        'SessionLinked',
        1,
        makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-1', linkRole: 'primary' }),
      ),
    ]);
    const unknown = resolveSessionLinkage([]);
    const ambiguous = resolveSessionLinkage([
      makeEventEnvelope(
        'SessionLinked',
        1,
        makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-1', linkRole: 'primary' }),
      ),
      makeEventEnvelope(
        'SessionLinked',
        2,
        makeSessionLinkedPayload({ linkOrdinal: 2, sessionId: 'session-2', linkRole: 'primary' }),
      ),
    ]);

    expect(known.launch.linkage).toBe('known');
    expect(unknown.launch.linkage).toBe('unknown');
    expect(ambiguous.classification).toBe('ambiguous');
    expect(ambiguous.launch.linkage).toBe('ambiguous');
  });
});
