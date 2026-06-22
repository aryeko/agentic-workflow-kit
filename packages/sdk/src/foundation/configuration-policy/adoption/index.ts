import { configurationSchemaMarker, type Result } from '../schema/index.js';

export type ConfigSource = {
  readonly path: string;
  readonly content: string;
};

export type ArtifactClass =
  | 'run-event-log'
  | 'projection'
  | 'resolved-policy'
  | 'capability-attestation'
  | 'launch-artifact'
  | 'unknown';

export type ArtifactSource = {
  readonly path: string;
  readonly class: ArtifactClass;
  readonly marker?: string;
  readonly contentHash: string;
};

export type AdoptionSource = {
  readonly config: ConfigSource;
  readonly artifacts: readonly ArtifactSource[];
};

export type AdoptionDiagnosticState = 'adoption-incompatible' | 'adoption-unknown-artifact';

export type AdoptionDiagnostic = {
  readonly state: AdoptionDiagnosticState;
  readonly path: string;
  readonly observedMarker?: string;
  readonly reason: string;
  readonly guidanceRef: string;
};

export type AdoptionDiagnosticEmitted = {
  readonly diagnostic: AdoptionDiagnostic;
  readonly at: string;
};

export type PolicyResolutionFailedReason =
  | 'adoption-incompatible'
  | 'adoption-unknown-artifact'
  | 'config-invalid'
  | 'profile-unknown'
  | 'override-invalid'
  | 'unsupported-deferred-capability'
  | 'provenance-write-failed';

export type PolicyResolutionFailed = {
  readonly reason: PolicyResolutionFailedReason;
  readonly blockingState: string;
  readonly at: string;
};

export type AdoptionAppendIntent = {
  readonly domain: 'fnd-01';
  readonly type: 'AdoptionDiagnosticEmitted' | 'PolicyResolutionFailed';
  readonly occurredAt: string;
  readonly payload: AdoptionDiagnosticEmitted | PolicyResolutionFailed;
  readonly durability: 'barrier';
  readonly correlationId?: string;
};

export type AdoptionReport = {
  readonly diagnostics: readonly AdoptionDiagnostic[];
  readonly mayLaunch: boolean;
  readonly appendIntents: readonly AdoptionAppendIntent[];
};

export type AdoptionDiagnosticFailure =
  | {
      readonly reason: 'config-loaded-write-failed';
      readonly blockingState: 'config-loaded-unrecorded';
    }
  | {
      readonly reason: 'adoption-diagnostic-write-failed';
      readonly blockingState: 'adoption-diagnostic-unrecorded';
    };

export type ConfigLoaded = {
  readonly configRef: string;
  readonly schema: typeof configurationSchemaMarker;
  readonly contentHash: string;
  readonly at: string;
};

export type DurableEventWriter = {
  appendConfigLoaded(event: ConfigLoaded): Result<{ readonly transactionId: string }, 'append-failed'>;
};

export type AdoptionContext = {
  readonly eventWriter: DurableEventWriter;
  readonly occurredAt: string;
  readonly confirmAppendIntents?: (appendIntents: readonly AdoptionAppendIntent[]) => boolean;
};

export interface AdoptionConfigurationPolicy {
  diagnoseAdoption(
    sources: AdoptionSource,
    context: AdoptionContext,
  ): Result<AdoptionReport, AdoptionDiagnosticFailure>;
}

const KNOWN_CURRENT_ARTIFACT_MARKERS = new Set<string>([
  'kit-vnext.event-log.v1',
  'kit-vnext.projection.v1',
  'kit-vnext.resolved-policy.v1',
  'kit-vnext.capability-attestation.v1',
  'kit-vnext.launch.v1',
]);

const ADOPTION_GUIDANCE_REF =
  'docs/design/30-domain-reference/foundation/configuration-and-policy/README.md#adoption-diagnostics';
const ADOPTION_SCHEMA_GUIDANCE_REF =
  'docs/design/30-domain-reference/foundation/configuration-and-policy/schema-and-resolution.md#adoption-diagnostics';
const ADOPTION_UNRECORDED_STATE = 'adoption-diagnostic-unrecorded';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const hashContent = (value: string): string => {
  let hash = 0x811c9dc5;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
};

const hasLegacyMarker = (marker: string): boolean => marker.startsWith('kit-v1.');

const classifyConfig = (source: ConfigSource): AdoptionDiagnostic | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(source.content) as unknown;
  } catch {
    return {
      state: 'adoption-unknown-artifact',
      path: source.path,
      reason: 'Config content is not valid JSON or does not expose a recognized vNext marker.',
      guidanceRef: ADOPTION_SCHEMA_GUIDANCE_REF,
    };
  }

  if (!isPlainObject(parsed)) {
    return {
      state: 'adoption-unknown-artifact',
      path: source.path,
      reason: 'Config content does not expose a recognized vNext marker.',
      guidanceRef: ADOPTION_SCHEMA_GUIDANCE_REF,
    };
  }

  const marker = parsed.schema;

  if (marker === configurationSchemaMarker) {
    return null;
  }

  if (typeof marker === 'string' && hasLegacyMarker(marker)) {
    return {
      state: 'adoption-incompatible',
      path: source.path,
      observedMarker: marker,
      reason: `Config at ${source.path} uses legacy marker ${marker}.`,
      guidanceRef: ADOPTION_GUIDANCE_REF,
    };
  }

  return {
    state: 'adoption-unknown-artifact',
    path: source.path,
    observedMarker: typeof marker === 'string' ? marker : undefined,
    reason: 'Config content does not expose a recognized vNext marker.',
    guidanceRef: ADOPTION_SCHEMA_GUIDANCE_REF,
  };
};

const classifyArtifact = (artifact: ArtifactSource): AdoptionDiagnostic | null => {
  if (typeof artifact.marker !== 'string') {
    return {
      state: 'adoption-unknown-artifact',
      path: artifact.path,
      reason: `Artifact at ${artifact.path} does not expose a recognized vNext marker.`,
      guidanceRef: ADOPTION_SCHEMA_GUIDANCE_REF,
    };
  }

  if (KNOWN_CURRENT_ARTIFACT_MARKERS.has(artifact.marker)) {
    return null;
  }

  if (hasLegacyMarker(artifact.marker)) {
    return {
      state: 'adoption-incompatible',
      path: artifact.path,
      observedMarker: artifact.marker,
      reason: `Artifact at ${artifact.path} uses legacy marker ${artifact.marker}.`,
      guidanceRef: ADOPTION_GUIDANCE_REF,
    };
  }

  return {
    state: 'adoption-unknown-artifact',
    path: artifact.path,
    observedMarker: artifact.marker,
    reason: `Artifact at ${artifact.path} does not expose a recognized vNext marker.`,
    guidanceRef: ADOPTION_SCHEMA_GUIDANCE_REF,
  };
};

const buildDiagnosticEmittedIntent = (diagnostic: AdoptionDiagnostic, occurredAt: string): AdoptionAppendIntent => ({
  domain: 'fnd-01',
  type: 'AdoptionDiagnosticEmitted',
  occurredAt,
  durability: 'barrier',
  payload: {
    diagnostic,
    at: occurredAt,
  },
});

const buildFailureIntent = (reason: PolicyResolutionFailedReason, occurredAt: string): AdoptionAppendIntent => ({
  domain: 'fnd-01',
  type: 'PolicyResolutionFailed',
  occurredAt,
  durability: 'barrier',
  payload: {
    reason,
    blockingState: ADOPTION_UNRECORDED_STATE,
    at: occurredAt,
  },
});

const buildReport = (diagnostics: readonly AdoptionDiagnostic[], occurredAt: string): AdoptionReport => {
  if (diagnostics.length === 0) {
    return {
      diagnostics,
      mayLaunch: true,
      appendIntents: [],
    };
  }

  return {
    diagnostics,
    mayLaunch: false,
    appendIntents: [
      ...diagnostics.map((diagnostic) => buildDiagnosticEmittedIntent(diagnostic, occurredAt)),
      buildFailureIntent(diagnostics[0].state, occurredAt),
    ],
  };
};

const reportOrFailure = (
  report: AdoptionReport,
  context: AdoptionContext,
): Result<AdoptionReport, AdoptionDiagnosticFailure> => {
  if (
    !report.mayLaunch &&
    context.confirmAppendIntents !== undefined &&
    !context.confirmAppendIntents(report.appendIntents)
  ) {
    return {
      ok: false,
      error: {
        reason: 'adoption-diagnostic-write-failed',
        blockingState: 'adoption-diagnostic-unrecorded',
      },
    };
  }

  return {
    ok: true,
    value: report,
  };
};

export const diagnoseAdoption = (
  sources: AdoptionSource,
  context: AdoptionContext,
): Result<AdoptionReport, AdoptionDiagnosticFailure> => {
  const configDiagnostic = classifyConfig(sources.config);
  if (configDiagnostic !== null) {
    return reportOrFailure(buildReport([configDiagnostic], context.occurredAt), context);
  }

  const loadResult = context.eventWriter.appendConfigLoaded({
    configRef: sources.config.path,
    schema: configurationSchemaMarker,
    contentHash: hashContent(sources.config.content),
    at: context.occurredAt,
  });

  if (!loadResult.ok) {
    return {
      ok: false,
      error: {
        reason: 'config-loaded-write-failed',
        blockingState: 'config-loaded-unrecorded',
      },
    };
  }

  const diagnostics = sources.artifacts.flatMap((artifact) => {
    const diagnostic = classifyArtifact(artifact);
    return diagnostic === null ? [] : [diagnostic];
  });

  return reportOrFailure(buildReport(diagnostics, context.occurredAt), context);
};

export const adoptionConfigurationPolicy: AdoptionConfigurationPolicy = {
  diagnoseAdoption,
};

export const configurationPolicy = adoptionConfigurationPolicy;

export { configurationSchemaMarker };
