import type { CapabilityAttestation } from '../../../src/index.js';

type HasEventId = 'eventId' extends keyof CapabilityAttestation ? true : false;

const hasEventId = false satisfies HasEventId;

const validAttestation = {
  capability: 'canKill',
  probeMethod: 'live-smoke',
  result: 'positive',
  evidenceRef: 'artifact://attestation',
  scope: 'worker',
  expiry: '2026-06-22T12:00:00.000Z',
  driverVersion: '1.2.3',
  platform: 'darwin-arm64',
  freshnessKey: 'driver@1.2.3:worker',
  at: '2026-06-22T11:00:00.000Z',
} satisfies CapabilityAttestation<'canKill'>;

const eventIdBearingAttestation: CapabilityAttestation<'canKill'> = {
  ...validAttestation,
  // @ts-expect-error AC-4 forbids a pre-assigned eventId field.
  eventId: 'evt-123',
};

void hasEventId;
void eventIdBearingAttestation;
