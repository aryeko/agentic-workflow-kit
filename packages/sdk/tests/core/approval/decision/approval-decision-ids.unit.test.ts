import crypto from 'node:crypto';

import { describe, expect, it, vi } from 'vitest';

import { decideApproval } from '../../../../src/core/approval/decision/index.js';

import {
  allowGate,
  createBaseReplay,
  createIdGenerator,
  createPolicy,
  createProjections,
  createRequest,
  evaluatedAt,
} from './shared.js';

describe('core-03-s2 approval decision id generation', () => {
  it('mints decision and grant ids from the injected generator in stable order', () => {
    const randomSpy = vi.spyOn(Math, 'random');
    const uuidSpy = vi.spyOn(crypto, 'randomUUID');

    const result = decideApproval({
      request: createRequest(),
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

    expect(result.value.decision.decisionId).toBe('decision-01');
    expect(result.value.decision.policyGrantPlan?.grantId).toBe('grant-01');
    expect(randomSpy).not.toHaveBeenCalled();
    expect(uuidSpy).not.toHaveBeenCalled();
  });

  it('consumes only a decision id when no grant plan is produced', () => {
    const result = decideApproval({
      request: createRequest(),
      risk: 'medium',
      mode: 'manual',
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

    expect(result.value.decision.decisionId).toBe('decision-02');
    expect(result.value.decision.policyGrantPlan).toBeUndefined();
  });
});
