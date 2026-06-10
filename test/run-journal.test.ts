import { describe, expect, it } from 'vitest';
import { RunJournal } from '../packages/orchestrator/src/runner/RunJournal.js';
import type { ArtifactStore, RunEvent } from '../packages/orchestrator/src/types.js';

class MemoryArtifactStore implements ArtifactStore {
  readonly events: Record<string, unknown>[] = [];

  async writeJson(): Promise<void> {}

  async writeText(): Promise<void> {}

  async appendEvent(event: RunEvent): Promise<void> {
    this.events.push(event);
  }
}

describe('run journal', () => {
  it('records write-time timestamps and defaults event time to write time', async () => {
    const artifactStore = new MemoryArtifactStore();
    const journal = new RunJournal({
      artifactStore,
      clock: {
        now: () => '2026-06-10T21:00:00.000Z',
        nowMs: () => 0,
      },
    });

    await journal.record('phase_started');
    await journal.record('external_phase_completed', { eventAt: '2026-06-10T20:59:00.000Z' });
    await journal.record('caller_timestamp_ignored', {
      recordedAt: '2026-01-01T00:00:00.000Z',
      eventAt: '2026-06-10T20:58:00.000Z',
    });

    expect(artifactStore.events).toEqual([
      {
        recordedAt: '2026-06-10T21:00:00.000Z',
        eventAt: '2026-06-10T21:00:00.000Z',
        type: 'phase_started',
      },
      {
        recordedAt: '2026-06-10T21:00:00.000Z',
        eventAt: '2026-06-10T20:59:00.000Z',
        type: 'external_phase_completed',
      },
      {
        recordedAt: '2026-06-10T21:00:00.000Z',
        eventAt: '2026-06-10T20:58:00.000Z',
        type: 'caller_timestamp_ignored',
      },
    ]);
  });
});
