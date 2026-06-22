import { describe, expect, it } from 'vitest';

import type { CapabilityAttestation, WorkSourceCapability, WorkSourceProvider } from '../../../src/index.js';

const probeResult = (): CapabilityAttestation<WorkSourceCapability>[] => [
  {
    capability: 'supportsClaim',
    probeMethod: 'mock-probe',
    result: 'positive',
    evidenceRef: 'artifact://work-source/probe',
    scope: 'provider',
    expiry: '2026-06-22T13:00:00.000Z',
    driverVersion: '1.0.0',
    platform: 'darwin-arm64',
    freshnessKey: 'work-source@1.0.0',
    at: '2026-06-22T12:00:00.000Z',
  },
];

describe('prov-03-s1 work source provider shape', () => {
  it('constructs a conforming provider with all seven operations', () => {
    const provider = {
      probeCapabilities: () => probeResult(),
      listTracks: () => [],
      listTasks: () => [],
      nextEligible: () => null,
      claim: () => ({
        task: {
          key: { workSourceId: 'ws', trackId: 'track', taskId: 'task' },
          title: 'Task',
          status: { native: 'todo', bucket: 'eligible' },
          target: { project: 'sdk' },
          spec: { refs: [] },
          dependencies: [],
          sourceRecordDigest: 'sha256:task',
        },
        snapshotRef: {
          id: 'artifact-1',
          digest: 'sha256:snapshot',
          size: 1,
          mediaType: 'application/json',
          retentionClass: 'evidence',
          classification: 'internal',
          redactionState: 'raw',
        },
        snapshotDigest: 'sha256:snapshot',
      }),
      release: () => undefined,
      writeStatus: () => ({
        written: true,
        updatedRecordDigest: 'sha256:updated',
        at: '2026-06-22T12:30:00.000Z',
      }),
    } satisfies WorkSourceProvider;

    expect(provider.probeCapabilities({} as never)).toEqual(probeResult());
    expect(provider.nextEligible({ trackIds: ['track'] })).toBeNull();
  });
});
