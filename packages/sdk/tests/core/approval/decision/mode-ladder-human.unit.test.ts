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

describe('core-03-s2 manual and high-risk human ladder', () => {
  it('always returns human-required in manual mode', () => {
    const result = decideApproval({
      request: createRequest(),
      risk: 'low',
      mode: 'manual',
      policy: createPolicy(),
      replay: createBaseReplay(),
      projections: createProjections(),
      evaluatedAt,
      ids: createIdGenerator('decision-01'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.decision.decision).toBe('human-required');
    expect(result.value.decision.decidedBy).toBe('system');
  });

  it('keeps assisted high risk on the human path', () => {
    const result = decideApproval({
      request: createRequest(),
      risk: 'high',
      mode: 'assisted',
      policy: createPolicy(),
      replay: createBaseReplay(),
      projections: createProjections(),
      evaluatedAt,
      ids: createIdGenerator('decision-02'),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.decision.decision).toBe('human-required');
    expect(result.value.failureState).toBe('approval-risk-high');
    expect(result.value.decision.decidedBy).toBe('system');
  });
});
