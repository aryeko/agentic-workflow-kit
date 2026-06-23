import { describe, expect, it } from 'vitest';
import { buildPreviewRunEnvelope as buildMcpPreviewRunEnvelope } from '../../../mcp/src/operator-smoke/preview-run.js';
import { buildPreviewRunEnvelope as buildCliPreviewRunEnvelope } from '../../src/operator-smoke/preview-run.js';

import {
  buildClock,
  buildIds,
  previewParamsFixture,
  serialize,
  sharedActorFixture,
  stripParityFields,
  targetFixture,
} from './support.js';

describe('edge-01-s2 CLI/MCP preview parity', () => {
  it('produces byte-identical preview envelopes after stripping surface-specific fields', () => {
    const cliEnvelope = buildCliPreviewRunEnvelope(
      previewParamsFixture,
      sharedActorFixture,
      targetFixture,
      buildClock().now,
      buildIds().nextId,
    );
    const mcpEnvelope = buildMcpPreviewRunEnvelope(
      previewParamsFixture,
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
