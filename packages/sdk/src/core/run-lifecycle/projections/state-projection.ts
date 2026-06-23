import type { RunReplay, RunStateProjection } from '../contracts/index.js';
import type { ReducedRunLifecycle } from '../lifecycle/index.js';

import { reduceRunLifecycle } from '../lifecycle/index.js';

function toLifecycleState(reduced: ReducedRunLifecycle): RunStateProjection['lifecycle'] {
  return reduced.lifecycle ?? 'created';
}

function findLastLifecycleWriterEpoch(replay: RunReplay): number | undefined {
  for (let index = replay.events.length - 1; index >= 0; index -= 1) {
    const event = replay.events[index];
    if (event.type === 'RunLifecycleTransitioned') {
      return event.writerEpoch;
    }
  }

  return undefined;
}

export function projectState(replay: RunReplay): RunStateProjection {
  const reduced = reduceRunLifecycle(replay.events);

  return {
    lifecycle: toLifecycleState(reduced),
    currentSequence: reduced.currentSequence ?? 0,
    writerEpoch: findLastLifecycleWriterEpoch(replay),
    terminalReason: reduced.terminalReason,
    degradedHealth: replay.health,
  };
}
