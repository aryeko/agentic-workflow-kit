import { describe, expect, it } from 'vitest';

import { validateLifecycleTransition } from '../../../../src/core/run-lifecycle/lifecycle/index.js';
import { configuredMissingPolicyBoundRefFixture } from './configured-missing-policybound-ref.fixture.js';
import { taskSnapshottedMissingSnapshotRefFixture } from './task-snapshotted-missing-snapshot-ref.fixture.js';

describe('core-01-s3 factual transition references', () => {
  it('rejects configured without a RunPolicyBound reference', () => {
    expect(validateLifecycleTransition('created', configuredMissingPolicyBoundRefFixture)).toEqual({
      ok: false,
      error: 'illegal-lifecycle-transition',
    });
  });

  it('rejects task-snapshotted without a TaskSnapshotRecorded reference', () => {
    expect(validateLifecycleTransition('configured', taskSnapshottedMissingSnapshotRefFixture)).toEqual({
      ok: false,
      error: 'illegal-lifecycle-transition',
    });
  });
});
