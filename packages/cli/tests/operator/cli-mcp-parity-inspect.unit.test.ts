import { describe, expect, it } from 'vitest';
import { buildInspectRunEnvelope as buildMcpInspectRunEnvelope } from '../../../mcp/src/operator-smoke/inspect-run.js';
import { buildInspectRunEnvelope as buildCliInspectRunEnvelope } from '../../src/operator-smoke/inspect-run.js';

import {
  buildClock,
  buildIds,
  inspectParamsFixture,
  serialize,
  sharedActorFixture,
  stripParityFields,
  targetFixture,
} from './support.js';

describe('edge-01-s2 CLI/MCP inspect parity', () => {
  it('produces byte-identical inspect envelopes after stripping surface-specific fields', () => {
    const cliEnvelope = buildCliInspectRunEnvelope(
      inspectParamsFixture,
      sharedActorFixture,
      targetFixture,
      buildClock().now,
      buildIds().nextId,
    );
    const mcpEnvelope = buildMcpInspectRunEnvelope(
      inspectParamsFixture,
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
