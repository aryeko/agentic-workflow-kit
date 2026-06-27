import type { ProviderControlKind } from '../../../../src/index.js';

// @ts-expect-error ProviderControlKind is restricted to the design catalog.
const invalidProviderControl: ProviderControlKind = 'host-respawn';

void invalidProviderControl;
