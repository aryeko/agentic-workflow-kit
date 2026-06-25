import {
  createCredentialScope,
  type CredentialRef,
  type EgressAttestation,
  type EgressPolicySource,
} from '../../../../src/index.js';
import type { issueEgressPolicy } from '../../../../src/index.js';

export const hashText = (value: string): string => `digest:${value}`;

export const ref: CredentialRef = {
  id: 'registry-read',
  kind: 'registry-read',
  purpose: 'install private packages',
  secret: {
    id: 'secret-ref:digest:{"key":"NPM_TOKEN","source":"env"}',
    source: 'env',
    key: 'NPM_TOKEN',
  },
  allowedParties: ['runner', 'worker'],
  allowedPhases: ['dependency-install'],
  allowedHosts: ['registry.npmjs.org'],
  ttlSeconds: 120,
  policyDigest: 'digest:policy-block',
};

export const scope = createCredentialScope({
  runId: 'run-123',
  taskId: 'task-456',
  operationId: 'operation-789',
  party: 'worker',
  phase: 'dependency-install',
  commandPrefix: 'pnpm install ',
  expiresAt: '2026-06-22T10:02:00.000Z',
  grantEventId: 'grant-123',
});

export const egressSource: EgressPolicySource = {
  defaultAction: 'deny',
  rules: [
    {
      credentialRefIds: ['registry-read'],
      protocols: ['https'],
      hosts: ['registry.npmjs.org'],
      ports: [443],
      phase: 'dependency-install',
      purpose: 'install private packages',
    },
  ],
  negativeProbes: [
    {
      host: 'github.com',
      protocol: 'https',
      expected: 'blocked',
      reason: 'non-registry egress denied',
    },
  ],
  requiredAttesters: [
    {
      point: 'execution-host',
      capability: 'egress-confinement',
      driverId: 'local-host',
    },
  ],
};

export const planDependencies = {
  hashText,
  now: '2026-06-22T10:01:00.000Z',
  issuedAt: '2026-06-22T10:00:00.000Z',
  host: 'registry.npmjs.org',
  command: 'pnpm install --frozen-lockfile',
  at: '2026-06-22T10:00:30.000Z',
  prevEventHash: 'digest:previous',
  auditSinkAvailable: true,
  resolveSecretMaterial: () => ({
    material: 'super-secret-value',
    materialHandle: 'memory://registry-read',
    fingerprintId: 'fp-registry-read',
  }),
};

export const createPositiveAttestation = (policy: ReturnType<typeof issueEgressPolicy>): EgressAttestation => {
  if (!policy.ok) {
    throw new Error('Expected egress policy to be issued.');
  }

  const requiredAttester = policy.value.requiredAttesters[0];
  return {
    id: 'attestation-1',
    point: 'execution-host',
    capability: 'egress-confinement',
    driverId: requiredAttester?.driverId ?? 'local-host',
    scopeDigest: requiredAttester?.scopeDigest ?? 'missing-scope-digest',
    egressPolicyDigest: policy.value.egressPolicyDigest,
    freshnessKey: policy.value.freshnessKey,
    platform: 'darwin',
    driverVersion: '1.0.0',
    expiresAt: '2026-06-22T10:02:30.000Z',
    evidenceRef: 'evidence://attestation-1',
    negativeProbeIds: [...policy.value.negativeProbeIds],
    result: 'positive',
  };
};
