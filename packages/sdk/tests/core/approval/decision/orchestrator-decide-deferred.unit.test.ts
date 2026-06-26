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

describe('core-03-s2 orchestrator decide defers in v1', () => {
  it('always denies with capability-deferred and does not replay llm logic', () => {
    const result = decideApproval({
      request: createRequest(),
      risk: 'medium',
      mode: 'assisted',
      policy: createPolicy(),
      replay: createBaseReplay(),
      projections: createProjections(),
      evaluatedAt,
      ids: createIdGenerator('decision-01'),
      consultOrchestrator: true,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.decision.decision).toBe('deny');
    expect(result.value.decision.reason).toBe('capability-deferred');
  });
});
