import type { OperatorActorRef } from 'sdk';
import {
  buildFixtureRunEventCursor,
  buildFixtureRunProjections,
  DeterministicClock,
  DeterministicIdGenerator,
  FakeOperatorControlSurface,
  FakeOsIdentityResolver,
} from 'testkit';
import { describe, expect, it } from 'vitest';

describe('edge-01-s2 testkit operator public import surface', () => {
  it('exports the operator smoke fakes and fixture builders from the testkit entrypoint', () => {
    const clock = new DeterministicClock('2026-01-01T00:00:00.000Z');
    const ids = new DeterministicIdGenerator('action-001');
    const controlSurface = new FakeOperatorControlSurface();
    const resolver = new FakeOsIdentityResolver();
    const actor: OperatorActorRef = resolver.resolve('cli');
    const cursor = buildFixtureRunEventCursor();
    const projections = buildFixtureRunProjections();

    expect(clock.now()).toBe('2026-01-01T00:00:00.000Z');
    expect(ids.nextId()).toBe('action-001');
    expect(controlSurface.callCount()).toBe(0);
    expect(actor.kind).toBe('os-user');
    expect(cursor.runId).toBeTruthy();
    expect(projections.summary.runId).toBeTruthy();
  });
});
