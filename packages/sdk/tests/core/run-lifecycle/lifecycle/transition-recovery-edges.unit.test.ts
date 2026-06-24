import { describe, expect, it } from 'vitest';

import {
  LIFECYCLE_LEGAL_EDGE_CATALOG,
  RECOVERY_RETRY_EVIDENCE_EVENT_TYPES,
  validateLifecycleTransition,
} from '../../../../src/core/run-lifecycle/lifecycle/index.js';
import { makeTransitionPayload } from './fixtures.js';
import { recoveryEdgeWrongAuthorityFixtures } from './recovery-edge-wrong-authority.fixture.js';

describe('core-01-s3 recovery edges', () => {
  it('accepts each recovery edge only with recovery authority and retry evidence', () => {
    const recoveryEdges = LIFECYCLE_LEGAL_EDGE_CATALOG.filter((edge) => edge.constraint.kind === 'recovery-retry');

    for (const edge of recoveryEdges) {
      for (const eventType of RECOVERY_RETRY_EVIDENCE_EVENT_TYPES) {
        expect(
          validateLifecycleTransition(
            edge.from,
            makeTransitionPayload({
              from: edge.from,
              to: edge.to,
              authority: 'recovery',
              sourceEventIds: [`${eventType}:evt-retry`],
            }),
          ),
        ).toEqual({ ok: true, value: undefined });
      }
    }

    for (const payload of recoveryEdgeWrongAuthorityFixtures) {
      expect(validateLifecycleTransition(payload.from, payload)).toEqual({
        ok: false,
        error: 'illegal-lifecycle-transition',
      });
    }
  });
});
