import { afterEach, describe, expect, it, vi } from 'vitest';

import { agentSessionLinked, fold, makeLifecycle, progressObserved, sessionLinked, workerSpawned } from './shared.js';

describe('core-04-s2 liveness fold determinism', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns deep-equal projections for identical committed events and explicit clock samples', () => {
    const events = [
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      progressObserved(5, 'session-01', 'tool-01'),
    ];

    vi.spyOn(Date, 'now').mockReturnValue(100);
    const first = fold(events, '2026-06-25T10:30:00.000Z');

    vi.spyOn(Date, 'now').mockReturnValue(200);
    const second = fold(events, '2026-06-25T10:30:00.000Z');

    expect(first).toEqual(second);
  });
});
