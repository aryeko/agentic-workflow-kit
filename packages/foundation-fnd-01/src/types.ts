import { z } from 'zod';
import type { NonEmptyArray, Result } from './result.js';

const grantScopeSchema = z.enum(['per-command', 'per-command-prefix', 'per-host', 'session']);
const escalationReasonSchema = z.enum(['dependency-install', 'verification', 'worker-tool', 'other']);
const phaseSchema = z.string().min(1);
const hostSchema = z.string().min(1);
const pathGlobSchema = z.string().min(1);

const capabilitySettingSchema = z
  .object({
    desired: z.boolean(),
    requireFreshAttestation: z.literal(true),
  })
  .strict();

const capabilitySettingPatchSchema = z
  .object({
    desired: z.boolean().optional(),
    requireFreshAttestation: z.literal(true).optional(),
  })
  .strict();

export const CredentialRefSourceSchema = z
  .object({
    id: z.string().min(1),
    kind: z.enum(['forge', 'registry-read', 'registry-publish', 'tool-api', 'verification']),
    purpose: z.string().min(1),
    secret: z
      .object({
        source: z.enum(['env', 'secret-manager']),
        key: z.string().min(1),
        version: z.string().min(1).optional(),
      })
      .strict(),
    allowedParties: z.array(z.enum(['runner', 'worker'])),
    allowedPhases: z.array(phaseSchema),
    allowedHosts: z.array(hostSchema),
    ttlSeconds: z.number().int().positive(),
  })
  .strict();

export const EgressRuleSourceSchema = z
  .object({
    credentialRefIds: z.array(z.string().min(1)),
    protocols: z.array(z.enum(['https', 'ssh'])),
    hosts: z.array(hostSchema),
    ports: z.array(z.number().int().min(1).max(65535)).optional(),
    phase: phaseSchema,
    purpose: z.string().min(1),
  })
  .strict();

const negativeProbeSourceSchema = z
  .object({
    host: hostSchema,
    protocol: z.enum(['https', 'ssh']),
    expected: z.literal('blocked'),
    reason: z.string().min(1),
  })
  .strict();

const requiredAttesterSourceSchema = z
  .object({
    point: z.literal('execution-host'),
    capability: z.literal('egress-confinement'),
    driverId: z.string().min(1),
  })
  .strict();

export const PolicyLayerSchema = z
  .object({
    run: z
      .object({
        mode: z.enum(['manual', 'assisted']),
        maxConcurrentRuns: z.number().int().positive(),
        requireCleanWorkspace: z.boolean(),
      })
      .strict(),
    provisioning: z
      .object({
        ownershipClass: z.enum(['owned', 'owned-remote', 'observe-only']),
        containmentRequired: z.boolean(),
        dependencyInstall: z
          .object({
            defaultGrant: z.enum(['none', 'narrow']),
            allowedPrefixes: z.array(z.string().min(1)),
          })
          .strict(),
      })
      .strict(),
    approval: z
      .object({
        mode: z.enum(['manual', 'assisted']),
        parkOnHumanLatency: z.boolean(),
        requireRecordedDecision: z.boolean(),
      })
      .strict(),
    escalationPolicy: z
      .object({
        allowedGrantScopes: z.array(grantScopeSchema),
        maxGrantScope: grantScopeSchema,
        denyByDefault: z.boolean(),
        grantRules: z.array(
          z
            .object({
              reason: escalationReasonSchema,
              scope: z.enum(['per-command', 'per-command-prefix']),
              prefixes: z.array(z.string().min(1)).optional(),
              requiresOperator: z.boolean().optional(),
            })
            .strict(),
        ),
      })
      .strict(),
    changePolicy: z
      .object({
        allowedChangePaths: z.array(pathGlobSchema),
      })
      .strict(),
    capabilities: z
      .object({
        'auto-merge': capabilitySettingSchema,
        'auto-recover': capabilitySettingSchema,
        'unattended-run': capabilitySettingSchema,
      })
      .strict(),
    credentialRefs: z
      .object({
        refs: z.array(CredentialRefSourceSchema),
      })
      .strict(),
    egress: z
      .object({
        defaultAction: z.literal('deny'),
        rules: z.array(EgressRuleSourceSchema),
        negativeProbes: z.array(negativeProbeSourceSchema),
        requiredAttesters: z.array(requiredAttesterSourceSchema),
      })
      .strict(),
    merge: z
      .object({
        runnerMayPush: z.boolean(),
        runnerMayOpenPr: z.boolean(),
        runnerMayMerge: z.boolean(),
        requiredEvidence: z.array(z.enum(['verification', 'ci', 'review', 'threads-resolved', 'protection'])),
        mergeMethod: z.enum(['merge', 'squash', 'rebase']).optional(),
      })
      .strict(),
  })
  .strict();

export const PolicyLayerPatchSchema = z
  .object({
    run: PolicyLayerSchema.shape.run.partial().strict().optional(),
    provisioning: z
      .object({
        ownershipClass: z.enum(['owned', 'owned-remote', 'observe-only']).optional(),
        containmentRequired: z.boolean().optional(),
        dependencyInstall: PolicyLayerSchema.shape.provisioning.shape.dependencyInstall.partial().strict().optional(),
      })
      .strict()
      .optional(),
    approval: PolicyLayerSchema.shape.approval.partial().strict().optional(),
    escalationPolicy: z
      .object({
        allowedGrantScopes: z.array(grantScopeSchema).optional(),
        maxGrantScope: grantScopeSchema.optional(),
        denyByDefault: z.boolean().optional(),
        grantRules: PolicyLayerSchema.shape.escalationPolicy.shape.grantRules.optional(),
      })
      .strict()
      .optional(),
    changePolicy: PolicyLayerSchema.shape.changePolicy.partial().strict().optional(),
    capabilities: z
      .object({
        'auto-merge': capabilitySettingPatchSchema.optional(),
        'auto-recover': capabilitySettingPatchSchema.optional(),
        'unattended-run': capabilitySettingPatchSchema.optional(),
      })
      .strict()
      .optional(),
    credentialRefs: PolicyLayerSchema.shape.credentialRefs.partial().strict().optional(),
    egress: PolicyLayerSchema.shape.egress.partial().strict().optional(),
    merge: PolicyLayerSchema.shape.merge.partial().strict().optional(),
  })
  .strict();

export const KitConfigSchema = z
  .object({
    schema: z.literal('kit-vnext.config.v1'),
    project: z
      .object({
        id: z.string().min(1),
        rootPolicy: z.literal('single-repo'),
        tracks: z.array(z.string().min(1)).optional(),
      })
      .strict(),
    profiles: z.record(z.string().min(1), PolicyLayerPatchSchema).optional(),
  })
  .strict();

export const RunConfigInputSchema = z
  .object({
    profile: z.string().min(1).optional(),
    overrides: PolicyLayerPatchSchema.optional(),
    run: z
      .object({
        taskId: z.string().min(1).optional(),
        trackId: z.string().min(1).optional(),
        dryRun: z.boolean().optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

export type PolicyLayer = z.infer<typeof PolicyLayerSchema>;
export type PolicyLayerPatch = z.infer<typeof PolicyLayerPatchSchema>;
export type KitConfig = z.infer<typeof KitConfigSchema>;
export type RunConfigInput = z.infer<typeof RunConfigInputSchema>;
export type ConfigSource = { readonly path: string; readonly content: string };
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
export type FieldProvenance = {
  readonly fieldPath: string;
  readonly sourceLayer: 'operator-override' | 'profile' | 'built-in-defaults';
  readonly profile?: string;
  readonly sourceRef: string;
  readonly valueHash: string;
};
export type ResolvedPolicy = {
  readonly schema: 'kit-vnext.resolved-policy.v1';
  readonly policy: PolicyLayer;
  readonly provenance: Record<string, FieldProvenance>;
};
export type AdoptionDiagnostic = {
  readonly state: 'adoption-incompatible' | 'adoption-unknown-artifact';
  readonly path: string;
  readonly observedMarker?: string;
  readonly reason: string;
  readonly guidanceRef: string;
};
export type ConfigLoaded = {
  readonly configRef: string;
  readonly schema: 'kit-vnext.config.v1';
  readonly contentHash: string;
  readonly at: string;
};
export type ConfigFieldResolved = FieldProvenance & {
  readonly runId: string;
  readonly at: string;
};
export type ConfigResolved = {
  readonly runId: string;
  readonly resolvedPolicyHash: string;
  readonly fieldCount: number;
  readonly at: string;
};
export type AdoptionDiagnosticEmitted = {
  readonly diagnostic: AdoptionDiagnostic;
  readonly at: string;
};
export type PolicyResolutionFailureReason =
  | 'adoption-incompatible'
  | 'adoption-unknown-artifact'
  | 'config-invalid'
  | 'profile-unknown'
  | 'override-invalid'
  | 'unsupported-deferred-capability'
  | 'provenance-write-failed';
export type PolicyResolutionFailed = {
  readonly reason: PolicyResolutionFailureReason;
  readonly blockingState: string;
  readonly at: string;
};
export type ConfigurationPolicyAppendIntent =
  | {
      readonly domain: 'fnd-01';
      readonly type: 'ConfigFieldResolved';
      readonly occurredAt: string;
      readonly payload: ConfigFieldResolved;
      readonly durability: 'durable';
      readonly correlationId?: string;
    }
  | {
      readonly domain: 'fnd-01';
      readonly type: 'ConfigResolved';
      readonly occurredAt: string;
      readonly payload: ConfigResolved;
      readonly durability: 'barrier';
      readonly correlationId?: string;
    }
  | {
      readonly domain: 'fnd-01';
      readonly type: 'AdoptionDiagnosticEmitted';
      readonly occurredAt: string;
      readonly payload: AdoptionDiagnosticEmitted;
      readonly durability: 'durable';
      readonly correlationId?: string;
    }
  | {
      readonly domain: 'fnd-01';
      readonly type: 'PolicyResolutionFailed';
      readonly occurredAt: string;
      readonly payload: PolicyResolutionFailed;
      readonly durability: 'barrier';
      readonly correlationId?: string;
    };
export type DurableEventWriter = {
  appendConfigLoaded(event: ConfigLoaded): Result<{ readonly transactionId: string }, 'append-failed'>;
};
export type AdoptionContext = {
  readonly eventWriter: DurableEventWriter;
  readonly occurredAt: string;
};
export type ResolutionContext = {
  readonly runId: string;
  readonly occurredAt: string;
  readonly correlationId?: string;
};
export type AdoptionReport = {
  readonly diagnostics: readonly AdoptionDiagnostic[];
  readonly mayLaunch: boolean;
  readonly appendIntents: readonly ConfigurationPolicyAppendIntent[];
};
export type ResolvedPolicyResult = {
  readonly resolvedPolicy: ResolvedPolicy;
  readonly appendIntents: NonEmptyArray<ConfigurationPolicyAppendIntent>;
};
export type AdoptionDiagnosticFailure = {
  readonly reason: 'config-loaded-write-failed';
  readonly blockingState: 'config-loaded-unrecorded';
};
export type PolicyResolutionFailure = {
  readonly reason: PolicyResolutionFailureReason;
  readonly blockingState: string;
  readonly diagnostic?: AdoptionDiagnostic;
  readonly appendIntents?: NonEmptyArray<ConfigurationPolicyAppendIntent>;
};
export interface ConfigurationPolicy {
  diagnoseAdoption(
    sources: AdoptionSource,
    context: AdoptionContext,
  ): Result<AdoptionReport, AdoptionDiagnosticFailure>;
  resolveRunPolicy(
    source: ConfigSource,
    input: RunConfigInput,
    context: ResolutionContext,
  ): Result<ResolvedPolicyResult, PolicyResolutionFailure>;
}
