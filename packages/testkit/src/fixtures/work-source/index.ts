import type { StatusBuckets } from 'sdk';

import type { MockWorkSourceOptions } from '../../work-source/mock-work-source-provider.js';

export const workSourceStatusBuckets = {
  eligible: ['todo'],
  inProgress: ['doing'],
  complete: ['done'],
  blocked: ['blocked'],
} satisfies StatusBuckets;

export const workSourceIncidentFixtures = {
  mockBacklog: {
    fixtureId: 'mock-backlog',
    options: {
      workSourceId: 'mock-source',
      now: '2026-06-22T12:00:00.000Z',
      tracks: [
        {
          trackId: 'track-a',
          statusBuckets: workSourceStatusBuckets,
          tasks: [
            { taskId: 'task-1', title: 'Ready task', status: 'todo', targetProject: 'sdk' },
            { taskId: 'task-2', title: 'Done dependency', status: 'done', targetProject: 'sdk' },
          ],
        },
      ],
    },
  },
  claimStatusRace: {
    fixtureId: 'claim-status-race',
    options: {
      workSourceId: 'mock-source',
      now: '2026-06-22T12:00:00.000Z',
      tracks: [
        {
          trackId: 'track-a',
          statusBuckets: workSourceStatusBuckets,
          tasks: [{ taskId: 'task-1', title: 'Race task', status: 'todo', targetProject: 'sdk' }],
        },
      ],
    },
  },
  malformedTask: {
    fixtureId: 'malformed-task',
    options: {
      workSourceId: 'mock-source',
      now: '2026-06-22T12:00:00.000Z',
      tracks: [
        {
          trackId: 'track-a',
          statusBuckets: workSourceStatusBuckets,
          tasks: [
            {
              taskId: 'task-1',
              title: 'Missing dependency',
              status: 'todo',
              targetProject: 'sdk',
              dependencies: [{ workSourceId: 'mock-source', trackId: 'track-a', taskId: 'missing' }],
            },
          ],
        },
        {
          trackId: 'track-malformed',
          statusBuckets: workSourceStatusBuckets,
          malformedDiagnostic: 'Mock malformed track fixture.',
          tasks: [],
        },
      ],
    },
  },
  degradedStorage: {
    fixtureId: 'degraded-storage',
    options: {
      workSourceId: 'mock-source',
      now: '2026-06-22T12:00:00.000Z',
      unavailable: { kind: 'work-source-unavailable', message: 'Mock source unavailable.' },
      tracks: [],
    },
  },
} as const satisfies Record<string, { readonly fixtureId: string; readonly options: MockWorkSourceOptions }>;
