import { afterEach, describe, expect, it, vi } from 'vitest';

import { analyze } from '../../../../src/core/observability/analyzer/index.js';

import { createRequest, createSnapshot } from './shared.js';

describe('core-07-s2 analyze avoids ambient clocks', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses request.analyzedAt instead of Date.now', () => {
    const request = createRequest();
    const snapshot = createSnapshot();

    vi.spyOn(Date, 'now').mockReturnValue(100);
    const first = analyze(request, snapshot);

    vi.spyOn(Date, 'now').mockReturnValue(200);
    const second = analyze(request, snapshot);

    expect(first).toEqual(second);
  });
});
