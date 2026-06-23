import { describe, expect, it } from 'vitest';

import { replay } from '../../../../src/index.js';

describe('core-01-s2 public sdk replay import', () => {
  it('exports replay from the sdk entrypoint', () => {
    expect(replay).toBeTypeOf('function');
  });
});
