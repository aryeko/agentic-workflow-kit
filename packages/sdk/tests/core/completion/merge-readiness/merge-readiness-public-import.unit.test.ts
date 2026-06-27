import { evaluateMergeReadiness, mergeAllowed } from 'sdk';
import { describe, expect, it } from 'vitest';

describe('core-05-s3 public sdk merge readiness imports', () => {
  it('imports the merge readiness function surface from sdk', () => {
    expect(typeof mergeAllowed).toBe('function');
    expect(typeof evaluateMergeReadiness).toBe('function');
  });
});
