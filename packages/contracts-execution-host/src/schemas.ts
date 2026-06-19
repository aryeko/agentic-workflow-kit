import { z } from 'zod';
import type {
  CommandResult,
  ContainmentStrength,
  HostCapabilityAttestation,
  HostFailure,
  HostObservation,
  WorkspaceAttachment,
} from './types.js';

const isoDate = z.string().datetime({ offset: true });
const scopeValueSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

export const artifactRefSchema = z
  .object({
    id: z.string().min(1),
    digest: z.string().min(1),
    size: z.number().int().nonnegative(),
    mediaType: z.string().min(1),
    retentionClass: z.string().min(1),
    classification: z.string().min(1),
    redactionState: z.enum(['raw', 'redacted', 'tombstoned']),
  })
  .strict();

export const workspaceAttachmentSchema: z.ZodType<WorkspaceAttachment> = z
  .object({
    kind: z.enum(['local-worktree', 'workspace-mount']),
    leaseId: z.string().min(1),
    runId: z.string().min(1),
    repoId: z.string().min(1),
    branchName: z.string().min(1),
    worktreePath: z.string().min(1).optional(),
    mountRef: z.string().min(1).optional(),
    cwd: z.string().min(1).optional(),
  })
  .strict();

export const hostFailureSchema: z.ZodType<HostFailure> = z
  .object({
    reason: z.enum([
      'host-capability-unattested',
      'workspace-mount-unavailable',
      'workspace-cwd-outside-mount',
      'credential-injection-rejected',
      'egress-confinement-unattested',
      'worker-spawn-failed',
      'host-observation-incomplete',
      'termination-unproven',
      'runner-command-capture-incomplete',
      'credential-destroy-unconfirmed',
    ]),
    message: z.string().min(1),
    retryable: z.boolean(),
    evidenceRef: artifactRefSchema.optional(),
    at: isoDate,
  })
  .strict();

export const commandResultSchema: z.ZodType<CommandResult> = z
  .object({
    operationId: z.string().min(1),
    commandDigest: z.string().min(1),
    cwd: z.string().min(1),
    exitCode: z.number().int().optional(),
    signal: z.string().min(1).optional(),
    stdoutRef: artifactRefSchema,
    stderrRef: artifactRefSchema,
    outputDigest: z.string().min(1),
    redactionApplied: z.literal(true),
    startedAt: isoDate,
    finishedAt: isoDate,
  })
  .strict()
  .superRefine((value, context) => {
    const hasExitCode = value.exitCode !== undefined;
    const hasSignal = value.signal !== undefined;
    if (hasExitCode === hasSignal) {
      context.addIssue({
        code: 'custom',
        path: ['exitCode'],
        message: 'exactly one of exitCode or signal is required',
      });
    }
  });

const outputObservationSchema = z
  .object({
    type: z.literal('output'),
    handleId: z.string().min(1),
    stream: z.enum(['stdout', 'stderr']),
    outputRef: artifactRefSchema,
    digest: z.string().min(1),
    redactionApplied: z.literal(true),
    at: isoDate,
  })
  .strict();

const structuredToolExitObservationSchema = z
  .object({
    type: z.literal('structured-tool-exit'),
    handleId: z.string().min(1),
    tool: z.string().min(1),
    exitCode: z.number().int(),
    payloadRef: artifactRefSchema.optional(),
    digest: z.string().min(1),
    at: isoDate,
  })
  .strict();

const processExitObservationSchema = z
  .object({
    type: z.literal('process-exit'),
    handleId: z.string().min(1),
    exitCode: z.number().int().optional(),
    signal: z.string().min(1).optional(),
    at: isoDate,
  })
  .strict()
  .superRefine((value, context) => {
    const hasExitCode = value.exitCode !== undefined;
    const hasSignal = value.signal !== undefined;
    if (hasExitCode === hasSignal) {
      context.addIssue({
        code: 'custom',
        path: ['exitCode'],
        message: 'exactly one of exitCode or signal is required',
      });
    }
  });

const hostFailureObservationSchema = z
  .object({
    type: z.literal('host-failure'),
    handleId: z.string().min(1).optional(),
    failure: hostFailureSchema,
    at: isoDate,
  })
  .strict();

export const hostObservationSchema: z.ZodType<HostObservation> = z.discriminatedUnion('type', [
  outputObservationSchema,
  structuredToolExitObservationSchema,
  processExitObservationSchema,
  hostFailureObservationSchema,
]);

export const hostCapabilityAttestationSchema: z.ZodType<HostCapabilityAttestation> = z
  .object({
    capability: z.enum(['canKill', 'containmentStrength', 'emitsStructuredToolExit', 'egress-confinement']),
    probeMethod: z.string().min(1),
    result: z.enum(['positive', 'negative']),
    evidenceRef: artifactRefSchema,
    scope: z.record(z.string().min(1), scopeValueSchema),
    expiry: isoDate,
    driverVersion: z.string().min(1),
    platform: z.string().min(1),
    freshnessKey: z.string().min(1),
    at: isoDate,
    details: z
      .object({
        containmentStrength: z.string().min(1).optional(),
        negativeProbeResults: z
          .array(
            z
              .object({
                id: z.string().min(1),
                host: z.string().min(1),
                protocol: z.string().min(1),
                expected: z.literal('blocked'),
                observed: z.enum(['blocked', 'reachable']),
                reason: z.string().min(1),
              })
              .strict(),
          )
          .optional(),
        egressPolicyDigest: z.string().min(1).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();

const containmentStrengths = ['none', 'process-group', 'kernel-tree', 'job-object'] as const;

export const isContainmentStrength = (value: unknown): value is ContainmentStrength =>
  typeof value === 'string' && containmentStrengths.includes(value as ContainmentStrength);

export const getAttestedContainmentStrength = (
  attestation: HostCapabilityAttestation,
): ContainmentStrength | undefined => {
  if (attestation.capability !== 'containmentStrength' || attestation.result !== 'positive') {
    return undefined;
  }

  const reported = attestation.details?.containmentStrength;
  return isContainmentStrength(reported) ? reported : undefined;
};

export const isHostFailure = (value: unknown): value is HostFailure =>
  typeof value === 'object' && value !== null && hostFailureSchema.safeParse(value).success;
