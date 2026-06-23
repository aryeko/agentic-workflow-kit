import { describe, expect, it } from 'vitest';

import type { Result } from '../../../../src/index.js';

describe('core-01-s1 Result type', () => {
  it('narrows success and failure arms by ok', () => {
    const success: Result<number, string> = { ok: true, value: 7 };
    const failure: Result<number, string> = { ok: false, error: 'nope' };

    const successValue = success.ok ? success.value : success.error;
    const failureValue = failure.ok ? failure.value : failure.error;

    expect(successValue).toBe(7);
    expect(failureValue).toBe('nope');
  });
});
