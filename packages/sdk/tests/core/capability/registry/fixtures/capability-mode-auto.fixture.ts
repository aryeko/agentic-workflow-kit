import type { CapabilityMode } from '../../../../../src/core/capability/registry/index.js';

// @ts-expect-error AC-2 excludes auto mode from CapabilityMode.
const invalidMode: CapabilityMode = 'auto';

void invalidMode;
