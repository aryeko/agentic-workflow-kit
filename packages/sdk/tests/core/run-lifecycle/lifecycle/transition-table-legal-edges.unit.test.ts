import { describe, expect, it } from 'vitest';

import {
  LIFECYCLE_LEGAL_EDGE_CATALOG,
  validateLifecycleTransition,
} from '../../../../src/core/run-lifecycle/lifecycle/index.js';
import { makeReference, makeTransitionPayload } from './fixtures.js';

describe('core-01-s3 legal lifecycle edges', () => {
  it('accepts every generated legal edge from the exported catalog', () => {
    expect(LIFECYCLE_LEGAL_EDGE_CATALOG).toHaveLength(50);

    for (const edge of LIFECYCLE_LEGAL_EDGE_CATALOG) {
      const payload = makeTransitionPayload({
        from: edge.from,
        to: edge.to,
        authority:
          edge.constraint.kind === 'recovery-retry' ? 'recovery' : edge.to === 'canceled' ? 'operator' : 'system',
        sourceEventIds: edge.constraint.requiredEventType
          ? [makeReference(edge.constraint.requiredEventType, `${edge.to}-1`)]
          : edge.constraint.kind === 'recovery-retry'
            ? [makeReference('RecoveryRetry', `${edge.to}-1`)]
            : [makeReference('Evidence', `${edge.to}-1`)],
      });

      const result = validateLifecycleTransition(edge.from, payload);

      expect(result.ok, `${edge.from ?? 'null'} -> ${edge.to}`).toBe(true);
    }
  });
});
