import { describe, expect, it } from 'vitest';

import type { WorkSourceProvider } from 'sdk';

import { createMockWorkSourceProvider, type MockWorkSourceOptions } from 'testkit';

const statusBuckets = {
  eligible: ['todo'],
  inProgress: ['doing'],
  complete: ['done'],
  blocked: ['blocked'],
};

describe('testkit Work Source public import surface', () => {
  it('exports a WorkSourceProvider-compatible mock and public options type', () => {
    const options = {
      workSourceId: 'mock-source',
      tracks: [
        {
          trackId: 'track-a',
          statusBuckets,
          tasks: [{ taskId: 'task-1', title: 'Ready task', status: 'todo', targetProject: 'sdk' }],
        },
      ],
    } satisfies MockWorkSourceOptions;
    const provider: WorkSourceProvider = createMockWorkSourceProvider(options);

    expect(provider.listTracks()).toEqual([
      expect.objectContaining({
        trackId: 'track-a',
        workSourceId: 'mock-source',
      }),
    ]);
  });
});
