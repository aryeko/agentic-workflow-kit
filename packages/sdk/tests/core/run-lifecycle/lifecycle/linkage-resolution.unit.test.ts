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

  it('returns the latest non-superseded owning link as the current session', () => {
    const resolved = resolveSessionLinkage([
      makeEventEnvelope(
        'SessionLinked',
        1,
        makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-primary', linkRole: 'primary' }),
      ),
      makeEventEnvelope(
        'SessionLinked',
        2,
        makeSessionLinkedPayload({ linkOrdinal: 2, sessionId: 'session-observer', linkRole: 'observer' }),
      ),
    ]);

    expect(resolved.classification).toBe('known');
    expect(resolved.currentSession?.sessionId).toBe('session-primary');
    expect(resolved.launch.currentSession?.sessionId).toBe('session-primary');
  });

  it('ignores supersession events whose replacement ordinal is not linked', () => {
    const resolved = resolveSessionLinkage([
      makeEventEnvelope('SessionLinked', 1, makeSessionLinkedPayload({ linkOrdinal: 1, sessionId: 'session-primary' })),
      makeEventEnvelope(
        'SessionLinkSuperseded',
        2,
        makeSessionLinkSupersededPayload({
          supersededOrdinal: 1,
          replacementOrdinal: 99,
          reason: 'invalid handoff',
          sourceEventId: 'evt-invalid-supersession',
        }),
      ),
    ]);

    expect(resolved.classification).toBe('known');
    expect(resolved.currentSession?.sessionId).toBe('session-primary');
    expect(resolved.launch.currentSession?.sessionId).toBe('session-primary');
  });
});
