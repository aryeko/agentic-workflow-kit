import { describe, expect, it } from 'vitest';

import type {
  OperatorCommandError,
  OperatorCommandStatus,
  OperatorEventRef,
} from '../../../src/edge/operator-command/index.js';
import { operatorCommandErrorFixture, operatorEventRefFixture } from './fixtures.js';

const renderStatus = (value: OperatorCommandStatus): string => {
  switch (value) {
    case 'completed':
    case 'accepted':
    case 'rejected':
    case 'deferred':
      return value;
    default: {
      const exhaustive: never = value;

      return exhaustive;
    }
  }
};

describe('edge-01-s1 operator response refs', () => {
  it('defines the exact status union and constructs response refs', () => {
    const statuses: readonly OperatorCommandStatus[] = ['completed', 'accepted', 'rejected', 'deferred'];
    const operatorEventRef: OperatorEventRef = operatorEventRefFixture;
    const commandError: OperatorCommandError = operatorCommandErrorFixture;

    expect(statuses.map(renderStatus)).toEqual(['completed', 'accepted', 'rejected', 'deferred']);
    expect(operatorEventRef.type).toBe('OperatorActionRecorded');
    expect(commandError.evidenceRefs[0]).toEqual(operatorEventRef);
  });
});
