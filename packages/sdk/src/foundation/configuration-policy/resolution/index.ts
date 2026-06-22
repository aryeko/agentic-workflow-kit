export { createConfigurationPolicy } from './create-configuration-policy.js';
export {
  resolvedPolicySchemaMarker,
  type ConfigSource,
  type ConfigurationPolicy,
  type CreateConfigurationPolicyDependencies,
  type NonEmptyArray,
  type PolicyResolutionFailure,
  type ResolvedPolicy,
  type ResolvedPolicyResult,
  type ResolutionContext,
} from './types.js';
export { stableCanonicalStringify } from '../provenance/index.js';
export type { ConfigurationPolicyAppendIntent } from '../events/index.js';
export type { FieldProvenance } from '../provenance/index.js';
export type { PolicyLayerPatch } from '../schema/index.js';
