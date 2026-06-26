import { describe, expect, it } from 'vitest';

import { classifyApprovalRisk } from '../../../../src/core/approval/decision/index.js';

import { createBaseReplay, createPolicy, createProjections, createRequest, evaluatedAt } from './shared.js';

describe('core-03-s2 low-risk classification', () => {
  it('returns low only when every workspace, policy, relay, and channel guarantee is provable', () => {
    const result = classifyApprovalRisk({
      request: createRequest(),
      policy: createPolicy(),
      replay: createBaseReplay(),
      projections: createProjections(),
      classifiedAt: evaluatedAt,
      requestEvidenceRefs: ['evidence:request-01'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.risk).toBe('low');
    expect(result.value.triggeredRuleIds).toEqual(['approval-low-command-allowlist']);
  });

  it.each([
    ['absent worktreePath', createRequest({ worktreePath: undefined }), 'medium'],
    ['cwd outside worktree', createRequest({ cwd: '/workspace/elsewhere' }), 'medium'],
    ['non-persistable channel', createRequest({ answerChannelPersistable: false }), 'medium'],
    ['missing allowlist match', createRequest({ command: 'npm test' }), 'medium'],
  ])('fails closed to %s -> %s', (_name, request, expectedRisk) => {
    const result = classifyApprovalRisk({
      request,
      policy: createPolicy(),
      replay: createBaseReplay(),
      projections: createProjections(),
      classifiedAt: evaluatedAt,
      requestEvidenceRefs: ['evidence:request-01'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.risk).toBe(expectedRisk);
  });
});
