import { describe, expect, it } from 'vitest';

import {
  agentSessionLinked,
  agentTerminal,
  fold,
  makeLifecycle,
  progressObserved,
  sessionLinked,
  workerExited,
  workerSpawned,
} from './shared.js';

describe('core-04-s2 terminal liveness fold', () => {
  it('records terminal observation as terminated without making the worker active again', () => {
    const agentResult = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      progressObserved(5),
      agentTerminal(6),
    ]);
    const hostResult = fold([
      makeLifecycle(1, 'worker-starting', 'workspace-ready'),
      workerSpawned(2),
      sessionLinked(3),
      agentSessionLinked(4),
      progressObserved(5),
      workerExited(6),
    ]);

    expect(agentResult.projection.state).toBe('terminated');
    expect(agentResult.projection.reason).toBe('worker-terminal-observed');
    expect(agentResult.projection.terminal).toBe(true);
    expect(hostResult.projection.state).toBe('terminated');
    expect(hostResult.advances.at(-1)?.advanceClass).toBe('terminal-observation');
  });
});
