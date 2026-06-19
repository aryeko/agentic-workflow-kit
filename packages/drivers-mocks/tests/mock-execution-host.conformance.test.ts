import {
  type CapabilityProbeDriver,
  createCapabilityAttestationCase,
  runConformanceSuite,
} from '@kit-vnext/conformance-kit';
import type { HostCapability, HostProbeScope } from '@kit-vnext/contracts-execution-host';
import { describe, expect, it } from 'vitest';
import { createMockExecutionHost } from '../src/index.js';

const now = '2026-06-19T08:00:00.000Z';
const expiry = '2026-06-19T09:00:00.000Z';

const createIds = () => {
  let next = 0;
  return {
    nextId: (purpose: string) => `${purpose}-${++next}`,
  };
};

const egressPolicy = {
  id: 'egress-runner',
  runId: 'run-1',
  operationId: 'op-1',
  audience: 'runner' as const,
  egressPolicyDigest: 'sha256:egress-runner',
  defaultAction: 'deny' as const,
  rules: [],
  negativeProbes: [
    {
      id: 'probe-block-example',
      host: 'blocked.example.test',
      protocol: 'https' as const,
      expected: 'blocked' as const,
      reason: 'prove deny-by-default',
    },
  ],
  requiredAttesters: [
    {
      point: 'execution-host' as const,
      capability: 'egress-confinement' as const,
      driverId: 'mock-execution-host',
      scopeDigest: 'scope-1',
      egressPolicyDigest: 'sha256:egress-runner',
      platform: 'test-platform',
      driverVersion: 'mock@1.0.0',
    },
  ],
  freshnessKey: 'freshness-1',
  expiresAt: expiry,
};

const host = createMockExecutionHost({
  driverId: 'mock-execution-host',
  driverVersion: 'mock@1.0.0',
  platform: 'test-platform',
  clock: { nowIso: () => now },
  idGenerator: createIds(),
  attestationExpiry: expiry,
});

const scopeFor = (capability: HostCapability): HostProbeScope => ({
  driverId: 'mock-execution-host',
  driverVersion: 'mock@1.0.0',
  platform: 'test-platform',
  freshnessKey: 'freshness-1',
  capabilities: [capability],
  workspaceKind: 'workspace-mount',
  egressPolicy: capability === 'egress-confinement' ? egressPolicy : undefined,
  at: now,
});

const driver: CapabilityProbeDriver = {
  probeCapability: (capability) => ({
    payload: host.probeCapabilities(scopeFor(capability as HostCapability))[0],
    elapsedMs: 1,
  }),
};

describe('Mock Execution Host conformance', () => {
  it('AC-11 passes the committed w2-1 conformance kit for positive host capabilities', async () => {
    const capabilities: HostCapability[] = [
      'canKill',
      'containmentStrength',
      'emitsStructuredToolExit',
      'egress-confinement',
    ];

    await expect(
      runConformanceSuite({
        lane: 'conformance-mock',
        driver,
        cases: capabilities.map((capability) =>
          createCapabilityAttestationCase({
            id: `prov-04-${capability}`,
            capability,
            maxProbeMs: 25,
            resolveEvidence: (ref) => host.readArtifact(ref).found,
          }),
        ),
        clock: {
          nowEpochMs: () => Date.parse(now),
        },
      }),
    ).resolves.toMatchObject({
      status: 'pass',
      cases: capabilities.map((capability) => ({
        id: `prov-04-${capability}`,
        status: 'pass',
      })),
    });
  });
});
