import type { OperatorActorRef, OperatorSurface, OsUserOperatorActorRef, UnavailableOsUserOperatorActorRef } from 'sdk';

const defaultResolvedAt = '2026-01-01T00:00:00.000Z';

const defaultActor = (surface: Extract<OperatorSurface, 'cli' | 'mcp'>): OsUserOperatorActorRef => ({
  schema: 'kit-vnext.operator-actor.v1',
  kind: 'os-user',
  username: 'testuser',
  uid: 501,
  gid: 20,
  groups: ['staff'],
  hostname: 'testhost',
  processId: 1,
  terminalRef: 'tty-001',
  surfaceClient: surface,
  resolvedAt: defaultResolvedAt,
  identityConfidence: 'verified-os',
});

const normalizeActor = (
  actor: OperatorActorRef,
  surface: Extract<OperatorSurface, 'cli' | 'mcp'>,
): OperatorActorRef => {
  if (actor.kind === 'os-user' || actor.kind === 'os-user-unavailable') {
    return {
      ...actor,
      surfaceClient: surface,
    };
  }

  return actor;
};

export class FakeOsIdentityResolver {
  readonly #actor: OperatorActorRef;

  constructor(
    actor: OperatorActorRef | OsUserOperatorActorRef | UnavailableOsUserOperatorActorRef = defaultActor('cli'),
  ) {
    this.#actor = actor;
  }

  resolve = (surface: Extract<OperatorSurface, 'cli' | 'mcp'>): OperatorActorRef =>
    normalizeActor(this.#actor, surface);
}
