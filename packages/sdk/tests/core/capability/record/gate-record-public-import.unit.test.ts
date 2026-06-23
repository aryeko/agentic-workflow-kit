import { appendGateRecord } from 'sdk';
import { describe, expect, it } from 'vitest';

describe('core-02-s3 public sdk exports', () => {
  it('imports appendGateRecord from the sdk entrypoint', () => {
    expect(typeof appendGateRecord).toBe('function');
  });
});
