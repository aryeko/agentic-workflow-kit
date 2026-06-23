import { describe, expect, it } from 'vitest';

import { analyze } from '../../../../src/core/observability/analyzer/index.js';

import { createRequest, createSnapshot } from './shared.js';

describe('core-07-s2 analyze determinism', () => {
  it('returns deep-equal results for identical request and snapshot inputs', () => {
    const request = createRequest();
    const snapshot = createSnapshot();

    const first = analyze(request, snapshot);
    const second = analyze(request, snapshot);

    expect(first).toEqual(second);
  });
});
