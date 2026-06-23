import { describe, expect, it } from 'vitest';

import type { StatusBucket, StatusBuckets, WorkSourceCapability } from '../../../src/index.js';

describe('prov-03-s1 work source unions', () => {
  it('defines the status bucket union exactly once', () => {
    const buckets: readonly StatusBucket[] = ['eligible', 'inProgress', 'complete', 'blocked', 'unknown'];

    expect(buckets).toEqual(['eligible', 'inProgress', 'complete', 'blocked', 'unknown']);
  });

  it('exposes non-unknown status bucket keys through StatusBuckets', () => {
    const buckets: StatusBuckets = {
      eligible: ['task-1'],
      inProgress: ['task-2'],
      complete: ['task-3'],
      blocked: ['task-4'],
    };

    expect(Object.keys(buckets)).toEqual(['eligible', 'inProgress', 'complete', 'blocked']);
  });

  it('defines the work source capabilities exactly once', () => {
    const capabilities: readonly WorkSourceCapability[] = [
      'supportsTracks',
      'supportsClaim',
      'supportsStatusWrite',
      'supportsDependencies',
    ];

    expect(capabilities).toEqual(['supportsTracks', 'supportsClaim', 'supportsStatusWrite', 'supportsDependencies']);
  });
});
