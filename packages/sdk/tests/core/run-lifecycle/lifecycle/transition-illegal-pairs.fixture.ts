import { LIFECYCLE_LEGAL_EDGE_CATALOG } from '../../../../src/core/run-lifecycle/lifecycle/index.js';
import type { RunLifecycleState } from '../../../../src/index.js';
import { ALL_LIFECYCLE_STATES } from './fixtures.js';

type OrderedStatePair = {
  from: RunLifecycleState | null;
  to: RunLifecycleState;
};

const legalPairs = new Set(LIFECYCLE_LEGAL_EDGE_CATALOG.map((edge) => `${edge.from ?? 'null'}->${edge.to}`));

export const illegalLifecyclePairs: OrderedStatePair[] = [null, ...ALL_LIFECYCLE_STATES].flatMap((from) =>
  ALL_LIFECYCLE_STATES.flatMap((to) =>
    legalPairs.has(`${from ?? 'null'}->${to}`)
      ? []
      : [
          {
            from,
            to,
          },
        ],
  ),
);
