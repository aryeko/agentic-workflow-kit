import { describe, expect, it } from 'vitest';

import type { RunReplayFailure } from '../../../../src/index.js';

const assertReplayFailureCode = (code: RunReplayFailure['code']): RunReplayFailure['code'] => {
  switch (code) {
    case 'malformed-envelope':
    case 'interior-corrupt':
    case 'event-log-unavailable':
    case 'malformed-declared-payload':
      return code;
    default: {
      const exhaustive: never = code;

      return exhaustive;
    }
  }
};

describe('core-01-s1 replay failure codes', () => {
  it('constructs each replay failure code', () => {
    const codes: readonly RunReplayFailure['code'][] = [
      'malformed-envelope',
      'interior-corrupt',
      'event-log-unavailable',
      'malformed-declared-payload',
    ];

    const failures: RunReplayFailure[] = codes.map((code) => ({
      code: assertReplayFailureCode(code),
      message: `${code} happened`,
      healthRecords: [],
    }));

    expect(failures.map((failure) => failure.code)).toEqual(codes);
  });
});
