import { describe, expect, it } from 'vitest';

import type { OperatorEnvelopeError, OperatorEnvelopeErrorCode } from '../../../src/edge/operator-command/index.js';

const renderCode = (value: OperatorEnvelopeErrorCode): string => {
  switch (value) {
    case 'params-invalid':
    case 'target-invalid':
    case 'idempotency-invalid':
    case 'identity-unavailable':
    case 'params-digest-unavailable':
      return value;
    default: {
      const exhaustive: never = value;

      return exhaustive;
    }
  }
};

describe('edge-01-s1 operator envelope errors', () => {
  it('defines the exact envelope error codes and constructs each token', () => {
    const errors: readonly OperatorEnvelopeError[] = [
      { code: 'params-invalid', message: 'params invalid' },
      { code: 'target-invalid', message: 'target invalid' },
      { code: 'idempotency-invalid', message: 'idempotency invalid' },
      { code: 'identity-unavailable', message: 'identity unavailable' },
      { code: 'params-digest-unavailable', message: 'params digest unavailable' },
    ];

    expect(errors.map((error) => renderCode(error.code))).toEqual([
      'params-invalid',
      'target-invalid',
      'idempotency-invalid',
      'identity-unavailable',
      'params-digest-unavailable',
    ]);
  });
});
