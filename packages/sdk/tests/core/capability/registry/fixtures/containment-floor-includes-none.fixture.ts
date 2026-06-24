import type { capabilityPostureCatalog } from '../../../../../src/core/capability/registry/index.js';

const invalidContainmentFloor = [
  'process-group',
  'kernel-tree',
  // @ts-expect-error AC-10 excludes none from the containment floor.
  'none',
] as const satisfies (typeof capabilityPostureCatalog)['auto-recover']['containmentFloor'];

void invalidContainmentFloor;
