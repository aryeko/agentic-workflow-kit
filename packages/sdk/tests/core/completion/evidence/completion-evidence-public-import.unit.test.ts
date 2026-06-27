import { classifyChangedPaths, evaluateCompletion, isVerificationFresh, selectCompletionCandidateHead } from 'sdk';
import { describe, expect, it } from 'vitest';

describe('core-05-s2 public sdk completion evidence imports', () => {
  it('imports the completion evidence function surface from sdk', () => {
    expect(typeof selectCompletionCandidateHead).toBe('function');
    expect(typeof classifyChangedPaths).toBe('function');
    expect(typeof isVerificationFresh).toBe('function');
    expect(typeof evaluateCompletion).toBe('function');
  });
});
