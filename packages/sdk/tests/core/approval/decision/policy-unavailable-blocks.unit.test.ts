import { describe, expect, it } from 'vitest';

import { classifyApprovalRisk, decideApproval } from '../../../../src/core/approval/decision/index.js';

import {
  createClassification,
  createIdGenerator,
  createPolicy,
  createRequest,
  createProjections,
  createReplay,
  createWriter,
  evaluatedAt,
} from './shared.js';

describe('core-03-s2 missing policy or provenance blocks decision work', () => {
  it('returns approval-policy-unavailable before classification or decision recording', () => {
    const request = createRequest();
    const replay = createReplay();
    const projections = createProjections();
    const writer = createWriter();

    const classification = classifyApprovalRisk({
      request,
      policy: undefined,
      replay,
      projections,
      classifiedAt: evaluatedAt,
    });

    const decision = decideApproval({
      request,
      risk: createClassification().risk,
      mode: 'assisted',
      policy: createPolicy({ provenance: {} }),
      replay,
      projections,
      evaluatedAt,
      ids: createIdGenerator('decision-01'),
    });

    expect(classification.ok).toBe(false);
    expect(classification.ok ? undefined : classification.error.failureState).toBe('approval-policy-unavailable');
    expect(decision.ok).toBe(false);
    expect(decision.ok ? undefined : decision.error.failureState).toBe('approval-policy-unavailable');
    expect(writer.appendCalls).toHaveLength(0);
  });
});
