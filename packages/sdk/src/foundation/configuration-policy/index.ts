export { configurationPolicy } from './adoption/index.js';
export type {
  AdoptionAppendIntent,
  AdoptionConfigurationPolicy,
  AdoptionContext,
  AdoptionDiagnostic,
  AdoptionDiagnosticEmitted,
  AdoptionDiagnosticFailure,
  AdoptionDiagnosticState,
  AdoptionReport,
  AdoptionSource,
  ArtifactClass,
  ArtifactSource,
  ConfigLoaded,
  DurableEventWriter,
  PolicyResolutionFailed as AdoptionPolicyResolutionFailed,
  PolicyResolutionFailedReason as AdoptionPolicyResolutionFailedReason,
} from './adoption/index.js';
export * from './defaults/index.js';
export * from './events/index.js';
export * from './policy-shapes/index.js';
export * from './provenance/index.js';
export { createConfigurationPolicy, resolvedPolicySchemaMarker } from './resolution/index.js';
export type {
  ConfigSource,
  CreateConfigurationPolicyDependencies,
  NonEmptyArray,
  PolicyResolutionFailure,
  ResolvedPolicy,
  ResolvedPolicyResult,
  ResolutionContext,
} from './resolution/index.js';
export * from './schema/index.js';

export type ConfigurationPolicy = import('./resolution/index.js').ConfigurationPolicy &
  import('./adoption/index.js').AdoptionConfigurationPolicy;
