import type { WorkSourceCapability } from './types.js';

export const workSourceCapabilities = [
  'supportsTracks',
  'supportsClaim',
  'supportsStatusWrite',
  'supportsDependencies',
] as const satisfies readonly WorkSourceCapability[];
