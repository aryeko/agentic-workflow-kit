import { describe, expect, it, vi } from 'vitest';

import { classifyApprovalRisk } from '../../../../src/core/approval/decision/index.js';

import { createBaseReplay, createPolicy, createProjections, createRequest } from './shared.js';

describe('core-03-s2 classification explicit time', () => {
  it('uses the provided classifiedAt and never reads ambient clock time', () => {
    const dateNowSpy = vi.spyOn(Date, 'now');
    const classifiedAt = '2026-06-26T09:07:00.000Z';

    const result = classifyApprovalRisk({
      request: createRequest(),
      policy: createPolicy(),
      replay: createBaseReplay(),
      projections: createProjections(),
      classifiedAt,
      requestEvidenceRefs: ['evidence:request-01'],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(result.value.classifiedAt).toBe(classifiedAt);
    expect(dateNowSpy).not.toHaveBeenCalled();
  });
});
