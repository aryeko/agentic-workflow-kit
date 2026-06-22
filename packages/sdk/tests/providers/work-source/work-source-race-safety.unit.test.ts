import { describe, expect, it } from 'vitest';

import type { TaskKey, WorkSourceError } from '../../../src/index.js';

const task: TaskKey = {
  workSourceId: 'work-source',
  trackId: 'track-a',
  taskId: 'task-1',
};

describe('prov-03-s1 work source race safety', () => {
  it('represents stale claims only as claim-conflict', () => {
    const conflict: WorkSourceError = {
      kind: 'claim-conflict',
      task,
      expectedRecordDigest: 'sha256:expected',
      observedRecordDigest: 'sha256:observed',
      expectedEpoch: 3,
      observedEpoch: 4,
    };

    expect(conflict.kind).toBe('claim-conflict');
    expect(conflict.expectedEpoch).toBe(3);
    expect(conflict.observedEpoch).toBe(4);
  });

  it('represents status authority divergence only as status-authority-conflict', () => {
    const conflict: WorkSourceError = {
      kind: 'status-authority-conflict',
      task,
      observedRecordDigest: 'sha256:observed',
    };

    expect(conflict.kind).toBe('status-authority-conflict');
    expect(conflict.observedRecordDigest).toBe('sha256:observed');
  });
});
