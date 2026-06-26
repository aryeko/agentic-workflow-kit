import type { Clock } from 'sdk';
import { describe, expect, it } from 'vitest';

describe('core-04-s1 supervision clock', () => {
  it('exports Clock as an injected zero-argument function returning an ISO timestamp string', () => {
    const clock: Clock = () => '2026-06-23T10:00:00.000Z';

    expect(clock()).toBe('2026-06-23T10:00:00.000Z');
  });
});
