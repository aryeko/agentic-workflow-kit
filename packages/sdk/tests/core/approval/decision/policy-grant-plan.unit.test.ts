import { describe, expect, it } from 'vitest';

import { decideApproval } from '../../../../src/core/approval/decision/index.js';

import {
  allowGate,
  createBaseReplay,
  createIdGenerator,
  createPolicy,
  createProjections,
  createRequest,
  createRuleOnlyPolicy,
  evaluatedAt,
} from './shared.js';

describe('core-03-s2 policy grant planning', () => {
  it('chooses the tightest valid scope before broader session-compatible options', () => {
    const result = decideApproval({
      request: createRequest({ requestedScope: 'session' }),
      risk: 'low',
      mode: 'assisted',
      policy: createPolicy(),
      replay: createBaseReplay(),
      projections: createProjections(),
      evaluatedAt,
      ids: createIdGenerator('decision-01', 'grant-01'),
      autoGrantGate: allowGate(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.decision.decision).toBe('human-required');
  });

  it('denies when the only candidate would widen the requested scope', () => {
    const result = decideApproval({
      request: createRequest({ requestedScope: 'per-command' }),
      risk: 'low',
      mode: 'assisted',
      policy: createRuleOnlyPolicy('per-command-prefix', ['per-command-prefix']),
      replay: createBaseReplay(),
      projections: createProjections(),
      evaluatedAt,
      ids: createIdGenerator('decision-02'),
      autoGrantGate: allowGate(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.decision.decision).toBe('deny');
    expect(result.value.decision.reason).toBe('approval-grant-mapping-invalid');
  });
});
