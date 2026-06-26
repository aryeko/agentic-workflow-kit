import { describe, expect, it } from 'vitest';

import { recordSupervisionLost } from '../../../../src/core/supervision/termination/index.js';

import { createWriter, runId } from './shared.js';

describe('core-04-s4 recordSupervisionLost', () => {
  it.each([
    'event-cursor-unavailable',
    'session-linkage-ambiguous',
    'agent-progress-unobservable',
    'termination-unavailable',
    'termination-unproven',
  ] as const)('appends a barrier supervision-lost fact for %s', async (reason) => {
    const writer = createWriter();
    const result = await recordSupervisionLost(
      {
        runId,
        reason,
        lostAt: '2026-06-26T09:50:00.000Z',
        sourceEventIds: ['evt-source-01'],
      },
      writer,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error(result.error.reason);
    }

    expect(writer.appendCalls[0]?.[0]).toMatchObject({
      domain: 'core-04',
      type: 'SupervisionLost',
      durability: 'barrier',
      occurredAt: '2026-06-26T09:50:00.000Z',
    });
    expect(result.value.payload.reason).toBe(reason);
    expect(result.value.payload.sourceEventIds).toEqual(['evt-source-01']);
  });

  it('rejects supervision-lost appends after terminal lifecycle closure', async () => {
    const writer = createWriter();
    const result = await recordSupervisionLost(
      {
        runId,
        reason: 'termination-unavailable',
        lostAt: '2026-06-26T09:50:00.000Z',
        sourceEventIds: ['evt-source-01'],
        guard: {
          lifecycleTerminal: true,
          supervisorStopped: false,
        },
      },
      writer,
    );

    expect(result.ok).toBe(false);
    expect(result.ok ? undefined : result.error.reason).toBe('post-terminal-core-04-fact-forbidden');
  });
});
