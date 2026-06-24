import type { OsUserOperatorActorRef } from '../../../src/edge/operator-command/index.js';

const invalidActor: OsUserOperatorActorRef = {
  schema: 'kit-vnext.operator-actor.v1',
  kind: 'os-user',
  hostname: 'build-host',
  processId: 3210,
  surfaceClient: 'cli',
  resolvedAt: '2026-06-23T12:00:00.000Z',
  identityConfidence: 'verified-os',
};

void invalidActor;
