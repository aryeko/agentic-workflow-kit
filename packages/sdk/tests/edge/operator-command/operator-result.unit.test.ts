import { describe, expect, it } from 'vitest';
import type { RunEventCursor } from '../../../src/core/run-lifecycle/contracts/index.js';
import type { OperatorCommandResult, PreviewRunView } from '../../../src/edge/operator-command/index.js';
import { operatorCommandResultFixture, runEventCursorFixture } from './fixtures.js';

describe('edge-01-s1 operator command result', () => {
  it('constructs the command result with a core run-event cursor', () => {
    const result: OperatorCommandResult<PreviewRunView> = operatorCommandResultFixture;
    const cursor: RunEventCursor = runEventCursorFixture;

    expect(result.schema).toBe('kit-vnext.operator-command-result.v1');
    expect(result.cursor).toEqual(cursor);
    expect(result.errors).toHaveLength(1);
  });
});
