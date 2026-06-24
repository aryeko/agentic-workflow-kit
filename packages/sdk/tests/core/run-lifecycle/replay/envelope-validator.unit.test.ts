import { describe, expect, it } from 'vitest';

import { isRunEventEnvelope } from '../../../../src/core/run-lifecycle/replay/envelope-validator.js';

import { lifecycleTransitionPayload, makeEnvelope, runId } from './test-support.js';

describe('core-01-s2 envelope validator', () => {
  it('accepts a valid run event envelope', () => {
    expect(isRunEventEnvelope(makeEnvelope(1, 'RunLifecycleTransitioned', lifecycleTransitionPayload), runId, 1)).toBe(
      true,
    );
  });

  it('rejects null and malformed optional fields', () => {
    expect(isRunEventEnvelope(null, runId, 1)).toBe(false);
    expect(
      isRunEventEnvelope(
        makeEnvelope(1, 'RunLifecycleTransitioned', lifecycleTransitionPayload, {
          artifactRefs: ['artifact://1', 2] as unknown as string[],
        }),
        runId,
        1,
      ),
    ).toBe(false);
  });
});
