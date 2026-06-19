import type {
  AdoptionDiagnostic,
  AdoptionReport,
  AdoptionSource,
  ConfigurationPolicyAppendIntent,
  ConfigSource,
} from './types.js';
import { stableHash } from './stable-json.js';

const recognizedArtifactMarkers = new Set([
  'kit-vnext.event-log.v1',
  'kit-vnext.projection.v1',
  'kit-vnext.resolved-policy.v1',
  'kit-vnext.capability-attestation.v1',
  'kit-vnext.launch.v1',
]);

const guidanceRef = 'docs/design/domains/foundation/fnd-01-configuration-and-policy/README.md#adoption-diagnostics';

export const parseJson = (source: ConfigSource): unknown => {
  try {
    return JSON.parse(source.content) as unknown;
  } catch {
    return undefined;
  }
};

export const markerOf = (value: unknown): string | undefined =>
  value !== null &&
  typeof value === 'object' &&
  Object.hasOwn(value as Record<string, unknown>, 'schema') &&
  typeof (value as Record<string, unknown>).schema === 'string'
    ? (value as Record<string, string>).schema
    : undefined;

export const configDiagnostic = (source: ConfigSource): AdoptionDiagnostic | undefined => {
  const marker = markerOf(parseJson(source));
  if (marker === 'kit-vnext.config.v1') {
    return undefined;
  }
  if (marker) {
    return {
      state: 'adoption-incompatible',
      path: source.path,
      observedMarker: marker,
      reason: `Configuration marker ${marker} is not supported by kit-vnext.`,
      guidanceRef,
    };
  }
  return {
    state: 'adoption-unknown-artifact',
    path: source.path,
    reason: 'Configuration has no recognized kit-vnext schema marker.',
    guidanceRef,
  };
};

export const diagnosticsFor = (sources: AdoptionSource): readonly AdoptionDiagnostic[] => {
  const config = configDiagnostic(sources.config);
  const artifactDiagnostics = sources.artifacts.flatMap((artifact): readonly AdoptionDiagnostic[] => {
    if (artifact.marker && recognizedArtifactMarkers.has(artifact.marker) && artifact.class !== 'unknown') {
      return [];
    }
    if (artifact.marker) {
      return [
        {
          state: 'adoption-incompatible',
          path: artifact.path,
          observedMarker: artifact.marker,
          reason: `Artifact marker ${artifact.marker} is not a recognized kit-vnext state marker.`,
          guidanceRef,
        },
      ];
    }
    return [
      {
        state: 'adoption-unknown-artifact',
        path: artifact.path,
        reason: 'Configured state artifact has no recognized kit-vnext marker.',
        guidanceRef,
      },
    ];
  });
  return [...(config ? [config] : []), ...artifactDiagnostics];
};

export const adoptionIntents = (
  diagnostics: readonly AdoptionDiagnostic[],
  occurredAt: string,
): readonly ConfigurationPolicyAppendIntent[] =>
  diagnostics.flatMap((diagnostic) => [
    {
      domain: 'fnd-01',
      type: 'AdoptionDiagnosticEmitted',
      occurredAt,
      payload: { diagnostic, at: occurredAt },
      durability: 'durable',
    },
    {
      domain: 'fnd-01',
      type: 'PolicyResolutionFailed',
      occurredAt,
      payload: { reason: diagnostic.state, blockingState: diagnostic.state, at: occurredAt },
      durability: 'barrier',
    },
  ]);

export const adoptionReport = (sources: AdoptionSource, occurredAt: string): AdoptionReport => {
  const diagnostics = diagnosticsFor(sources);
  return {
    diagnostics,
    mayLaunch: diagnostics.length === 0,
    appendIntents: adoptionIntents(diagnostics, occurredAt),
  };
};

export const configLoadedEvent = (source: ConfigSource, occurredAt: string) => ({
  configRef: source.path,
  schema: 'kit-vnext.config.v1' as const,
  contentHash: stableHash(source.content),
  at: occurredAt,
});
