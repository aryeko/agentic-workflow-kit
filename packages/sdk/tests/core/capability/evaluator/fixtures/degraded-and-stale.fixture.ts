import { createAttestationEvent, createReplay, createRequest, createScope, evaluatedAt } from '../shared.js';

const replay = createReplay({
  health: 'event-log-unavailable',
  healthRecords: [
    {
      kind: 'event-log-unavailable',
      detectedAt: evaluatedAt,
      storageHealth: 'network-fs-degraded',
      detail: 'store unavailable',
    },
  ],
  events: [
    createAttestationEvent('evt-forge-inspect-stale', 1, 'Forge', 'canInspectProtection', {
      expiry: evaluatedAt,
    }),
  ],
  lastSequence: 1,
});

export const degradedAndStaleFixture = {
  request: createRequest({
    scope: createScope({
      providerScopes: [
        {
          provider: 'Forge',
          scope: 'repo:aryeko/workflow-kit/pr:42/head#abc123',
          freshnessKey: 'forge:pr-42',
        },
      ],
    }),
  }),
  replay,
  projections: {
    state: {
      lifecycle: 'running',
      currentSequence: 1,
      writerEpoch: 2,
      degradedHealth: 'event-log-unavailable',
    },
    summary: {
      runId: replay.runId,
      status: 'running',
      artifactRefs: [],
      unknownEvents: [],
    },
    metrics: {
      eventCount: 1,
      retryCount: 0,
      parkedMs: 0,
    },
    launch: {
      linkage: 'known',
      linkHistory: [],
    },
  },
};
