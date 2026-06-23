import { describe, expect, it } from 'vitest';

import type { OperatorActionRecordedPayload } from '../../../src/edge/operator-command/index.js';
import { operatorActionRecordedPayloadFixture } from './fixtures.js';

type ResultIntent = OperatorActionRecordedPayload['resultIntent'];

const renderResultIntent = (value: ResultIntent): string => {
  switch (value) {
    case 'read':
    case 'mutate':
    case 'reject':
    case 'defer':
      return value;
    default: {
      const exhaustive: never = value;

      return exhaustive;
    }
  }
};

describe('edge-01-s1 operator action recorded payload', () => {
  it('constructs the audit payload and defines the exact result intents', () => {
    const payload: OperatorActionRecordedPayload = operatorActionRecordedPayloadFixture;
    const intents: readonly ResultIntent[] = ['read', 'mutate', 'reject', 'defer'];

    expect(payload.schema).toBe('kit-vnext.operator-action-recorded.v1');
    expect(intents.map(renderResultIntent)).toEqual(['read', 'mutate', 'reject', 'defer']);
  });
});
