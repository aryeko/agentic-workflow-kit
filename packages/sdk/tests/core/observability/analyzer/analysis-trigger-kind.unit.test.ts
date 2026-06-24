import { describe, expect, it } from 'vitest';

import type { AnalysisTriggerKind } from '../../../../src/core/observability/analyzer/index.js';

const assertNever = (_value: never): never => {
  throw new Error('unreachable');
};

const describeKind = (kind: AnalysisTriggerKind): string => {
  switch (kind) {
    case 'terminal-lifecycle':
    case 'blocked-transition':
    case 'supervision-lost':
    case 'stale-progress':
    case 'recovery-decision':
      return kind;
    default:
      return assertNever(kind);
  }
};

describe('core-07-s2 analysis trigger kind union', () => {
  it('contains exactly the five design trigger literals', () => {
    const kinds: AnalysisTriggerKind[] = [
      'terminal-lifecycle',
      'blocked-transition',
      'supervision-lost',
      'stale-progress',
      'recovery-decision',
    ];

    expect(kinds.map(describeKind)).toEqual([
      'terminal-lifecycle',
      'blocked-transition',
      'supervision-lost',
      'stale-progress',
      'recovery-decision',
    ]);
  });
});
