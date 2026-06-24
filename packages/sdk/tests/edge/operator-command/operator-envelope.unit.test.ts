import { describe, expect, it } from 'vitest';

import type { OperatorCommandEnvelope, PreviewRunParams } from '../../../src/edge/operator-command/index.js';
import { operatorCommandEnvelopeFixture } from './fixtures.js';

describe('edge-01-s1 operator command envelope', () => {
  it('constructs the request envelope for preview-run', () => {
    const envelope: OperatorCommandEnvelope<PreviewRunParams> = operatorCommandEnvelopeFixture;

    expect(envelope.schema).toBe('kit-vnext.operator-command.v1');
    expect(envelope.params.dryRun).toBe(true);
    expect(envelope.envelopeErrors?.[0]?.code).toBe('params-invalid');
  });
});
