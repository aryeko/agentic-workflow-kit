import { describe, expect, it } from 'vitest';

import { isCapabilityAttestation } from '../../../src/index.js';

import { capabilityAttestationFixture, workerHandleFixture } from './fixtures/shared.js';

describe('prov-01 agent capability attestation reuse', () => {
  it('uses the shared CapabilityAttestation shape for agent capabilities', () => {
    const attestation = capabilityAttestationFixture();

    expect(isCapabilityAttestation(attestation)).toBe(true);
    expect(attestation.capability).toBe('canRelayApproval');
    expect(attestation.details).toEqual({
      protocolSurface: 'codex-app-server',
      hostAttestationIds: ['host-att-01'],
    });
  });

  it('uses execution-host WorkerHandle instead of redefining host worker identity', () => {
    const worker = workerHandleFixture();

    expect(worker.handleId).toBe('worker-handle-01');
    expect(worker.containmentRef).toBe('containment://worker-handle-01');
  });
});
