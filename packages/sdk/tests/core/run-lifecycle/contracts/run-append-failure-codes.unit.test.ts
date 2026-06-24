import { describe, expect, it } from 'vitest';

import type { RunAppendFailure, RunAppendFailureCode } from '../../../../src/index.js';

const assertAppendFailureCode = (code: RunAppendFailureCode): RunAppendFailureCode => {
  switch (code) {
    case 'stale-writer-fenced':
    case 'sequence-conflict':
    case 'illegal-lifecycle-transition':
    case 'durability-insufficient':
    case 'partial-ack-unknown':
    case 'interior-corrupt':
    case 'event-log-unavailable':
      return code;
    default: {
      const exhaustive: never = code;

      return exhaustive;
    }
  }
};

describe('core-01-s1 append failure codes', () => {
  it('constructs each append failure code as a RunAppendFailure', () => {
    const codes: readonly RunAppendFailureCode[] = [
      'stale-writer-fenced',
      'sequence-conflict',
      'illegal-lifecycle-transition',
      'durability-insufficient',
      'partial-ack-unknown',
      'interior-corrupt',
      'event-log-unavailable',
    ];

    const failures: RunAppendFailure[] = codes.map((code) => ({
      code: assertAppendFailureCode(code),
      message: `${code} happened`,
      retryable: code !== 'illegal-lifecycle-transition',
    }));

    expect(failures.map((failure) => failure.code)).toEqual(codes);
  });
});
