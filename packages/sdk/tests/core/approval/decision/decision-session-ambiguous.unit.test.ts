import { describe, expect, it } from 'vitest';

import { decideApproval } from '../../../../src/core/approval/decision/index.js';

import {
  createBaseReplay,
  createIdGenerator,
  createPolicy,
  createProjections,
  createRequest,
  evaluatedAt,
} from './shared.js';

describe('core-03-s2 ambiguous current session blocks decisions', () => {
  it('returns blocked with approval-session-ambiguous and no grant plan', () => {
    const result = decideApproval({
      request: createRequest(),
      risk: 'medium',
      mode: 'assisted',
      policy: createPolicy(),
      replay: createBaseReplay(),
      projections: createProjections({ launch: { linkage: 'ambiguous', currentSession: undefined, linkHistory: [] } }),
      evaluatedAt,
      ids: createIdGenerator('decision-01'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.decision.decision).toBe('blocked');
    expect(result.value.decision.reason).toBe('approval-session-ambiguous');
    expect(result.value.failureState).toBe('approval-session-ambiguous');
    expect(result.value.decision.policyGrantPlan).toBeUndefined();
  });
});
