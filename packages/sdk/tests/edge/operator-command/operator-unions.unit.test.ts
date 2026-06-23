import { describe, expect, it } from 'vitest';

import type { OperatorActionKind, OperatorSurface } from '../../../src/edge/operator-command/index.js';

const renderSurface = (value: OperatorSurface): string => {
  switch (value) {
    case 'mcp':
    case 'cli':
    case 'external-trigger':
      return value;
    default: {
      const exhaustive: never = value;

      return exhaustive;
    }
  }
};

const renderActionKind = (value: OperatorActionKind): string => {
  switch (value) {
    case 'preview-run':
    case 'start-run':
    case 'inspect-run':
    case 'wait-run':
    case 'approval-decision':
    case 'stop-run':
    case 'handoff-run':
    case 'override-field':
    case 'request-recovery':
    case 'explain':
    case 'attention-ack':
      return value;
    default: {
      const exhaustive: never = value;

      return exhaustive;
    }
  }
};

describe('edge-01-s1 operator unions', () => {
  it('defines the exact operator surfaces', () => {
    const members: readonly OperatorSurface[] = ['mcp', 'cli', 'external-trigger'];

    expect(members.map(renderSurface)).toEqual(['mcp', 'cli', 'external-trigger']);
  });

  it('defines the exact operator action kinds', () => {
    const members: readonly OperatorActionKind[] = [
      'preview-run',
      'start-run',
      'inspect-run',
      'wait-run',
      'approval-decision',
      'stop-run',
      'handoff-run',
      'override-field',
      'request-recovery',
      'explain',
      'attention-ack',
    ];

    expect(members.map(renderActionKind)).toHaveLength(11);
  });
});
