import { describe, expect, it } from 'vitest';

import type { OperatorCommandTarget } from '../../../src/edge/operator-command/index.js';
import { operatorCommandTargetFixture } from './fixtures.js';

describe('edge-01-s1 operator command target', () => {
  it('constructs an empty target and a fully populated target', () => {
    const emptyTarget: OperatorCommandTarget = {};
    const fullTarget: OperatorCommandTarget = operatorCommandTargetFixture;

    expect(emptyTarget).toEqual({});
    expect(fullTarget.approvalRequestId).toBe('approval-1');
    expect(fullTarget.attentionId).toBe('attention-1');
  });
});
