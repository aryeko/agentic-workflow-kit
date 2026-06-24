import { describe, expect, it } from 'vitest';
import { buildStartRunEnvelope as buildMcpStartRunEnvelope } from '../../../mcp/src/operator-smoke/start-run.js';
import { buildStartRunEnvelope as buildCliStartRunEnvelope } from '../../src/operator-smoke/start-run.js';

import {
  buildClock,
  buildIds,
  serialize,
  sharedActorFixture,
  startParamsFixture,
  stripParityFields,
  targetFixture,
} from './support.js';

describe('edge-01-s2 CLI/MCP start parity', () => {
  it('produces byte-identical start envelopes after stripping surface-specific fields', () => {
    const cliEnvelope = buildCliStartRunEnvelope(
      startParamsFixture,
      sharedActorFixture,
      targetFixture,
      buildClock().now,
      buildIds().nextId,
    );
    const mcpEnvelope = buildMcpStartRunEnvelope(
      startParamsFixture,
      sharedActorFixture,
      targetFixture,
      buildClock().now,
      buildIds().nextId,
    );

    expect(cliEnvelope.surface).toBe('cli');
    expect(mcpEnvelope.surface).toBe('mcp');
    expect(serialize(stripParityFields(cliEnvelope))).toBe(serialize(stripParityFields(mcpEnvelope)));
  });
});
