import { describe, expect, it } from 'vitest';

import type { OperatorActorRef } from '../../../src/edge/operator-command/index.js';
import {
  deferredExternalTriggerActorFixture,
  osUserOperatorActorFixture,
  unavailableOsUserOperatorActorFixture,
} from './fixtures.js';

const describeActor = (actor: OperatorActorRef): string => {
  switch (actor.kind) {
    case 'os-user':
      return `${actor.username}@${actor.hostname}`;
    case 'os-user-unavailable':
      return `${actor.failureReason}@${actor.hostname}`;
    case 'external-trigger':
      return actor.principalRef;
    default: {
      const exhaustive: never = actor;

      return exhaustive;
    }
  }
};

describe('edge-01-s1 operator actor refs', () => {
  it('narrows each actor arm by kind', () => {
    const actors: readonly OperatorActorRef[] = [
      osUserOperatorActorFixture,
      unavailableOsUserOperatorActorFixture,
      deferredExternalTriggerActorFixture,
    ];

    expect(actors.map(describeActor)).toEqual([
      'arye@build-host',
      'lookup-failed@build-host',
      'trigger://scheduler/nightly',
    ]);
  });
});
