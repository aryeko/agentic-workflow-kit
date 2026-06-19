import { capabilityAttestationSchema as w2CapabilityAttestationSchema } from '@kit-vnext/conformance-kit';
import { describe, expect, it } from 'vitest';
import {
  type CommandResult,
  commandResultSchema,
  getAttestedContainmentStrength,
  type HostCapabilityAttestation,
  hostCapabilityAttestationSchema,
  hostObservationSchema,
  workspaceAttachmentSchema,
} from '../src/index.js';

const artifactRef = {
  id: 'artifact-1',
  digest: 'sha256:artifact',
  size: 12,
  mediaType: 'text/plain',
  retentionClass: 'short-lived',
  classification: 'internal',
  redactionState: 'redacted' as const,
};

const baseCommandResult = (): CommandResult => ({
  operationId: 'op-verify',
  commandDigest: 'sha256:command',
  cwd: '/workspace/repo',
  exitCode: 0,
  stdoutRef: artifactRef,
  stderrRef: { ...artifactRef, id: 'artifact-2', size: 0 },
  outputDigest: 'sha256:output',
  redactionApplied: true,
  startedAt: '2026-06-19T08:00:00.000Z',
  finishedAt: '2026-06-19T08:00:01.000Z',
});

const attestation = (result: 'positive' | 'negative' = 'positive'): HostCapabilityAttestation => ({
  eventId: 'attestation-event-1',
  capability: 'containmentStrength',
  probeMethod: 'mock-containment-probe',
  result,
  evidenceRef: { ...artifactRef, id: 'attestation-evidence' },
  scope: {
    driverId: 'mock-execution-host',
    workspaceKind: 'workspace-mount',
  },
  expiry: '2026-06-19T09:00:00.000Z',
  driverVersion: 'mock@1.0.0',
  platform: 'test-platform',
  freshnessKey: 'freshness-1',
  at: '2026-06-19T08:00:00.000Z',
  details: {
    containmentStrength: 'kernel-tree',
  },
});

const omit = <T extends object, K extends keyof T>(value: T, field: K): Omit<T, K> => {
  const { [field]: _omitted, ...rest } = value;
  return rest;
};

describe('Execution Host contract schemas', () => {
  it('AC-1 validates both workspace attachment kinds without required local path or PID fields', () => {
    expect(
      workspaceAttachmentSchema.parse({
        kind: 'local-worktree',
        leaseId: 'lease-1',
        runId: 'run-1',
        repoId: 'repo-1',
        branchName: 'codex/task',
      }),
    ).toMatchObject({
      kind: 'local-worktree',
    });

    expect(
      workspaceAttachmentSchema.parse({
        kind: 'workspace-mount',
        leaseId: 'lease-2',
        runId: 'run-1',
        repoId: 'repo-1',
        branchName: 'codex/task',
      }),
    ).toMatchObject({
      kind: 'workspace-mount',
    });
  });

  it('AC-3 accepts complete command capture for exit-code and signal variants only', () => {
    expect(commandResultSchema.parse(baseCommandResult())).toEqual(baseCommandResult());

    const signalResult = omit(baseCommandResult(), 'exitCode');
    expect(commandResultSchema.parse({ ...signalResult, signal: 'SIGTERM' })).toMatchObject({
      signal: 'SIGTERM',
    });

    expect(commandResultSchema.safeParse(omit(baseCommandResult(), 'outputDigest')).success).toBe(false);
    expect(commandResultSchema.safeParse(omit(baseCommandResult(), 'stdoutRef')).success).toBe(false);
    expect(commandResultSchema.safeParse(omit(baseCommandResult(), 'stderrRef')).success).toBe(false);
    expect(commandResultSchema.safeParse({ ...baseCommandResult(), signal: 'SIGTERM' }).success).toBe(false);
    expect(commandResultSchema.safeParse(omit(baseCommandResult(), 'exitCode')).success).toBe(false);
  });

  it('AC-8 validates output observations with redaction and ArtifactRef evidence', () => {
    expect(
      hostObservationSchema.parse({
        type: 'output',
        handleId: 'worker-1',
        stream: 'stdout',
        outputRef: artifactRef,
        digest: 'sha256:output',
        redactionApplied: true,
        at: '2026-06-19T08:00:00.000Z',
      }),
    ).toMatchObject({
      type: 'output',
      redactionApplied: true,
    });

    expect(
      hostObservationSchema.safeParse({
        type: 'output',
        handleId: 'worker-1',
        stream: 'stdout',
        outputRef: artifactRef,
        digest: 'sha256:output',
        redactionApplied: false,
        at: '2026-06-19T08:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('AC-8 validates process-exit observations with exactly one terminal outcome', () => {
    expect(
      hostObservationSchema.safeParse({
        type: 'process-exit',
        handleId: 'worker-1',
        exitCode: 0,
        at: '2026-06-19T08:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(
      hostObservationSchema.safeParse({
        type: 'process-exit',
        handleId: 'worker-1',
        signal: 'SIGTERM',
        at: '2026-06-19T08:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(
      hostObservationSchema.safeParse({
        type: 'process-exit',
        handleId: 'worker-1',
        exitCode: 0,
        signal: 'SIGTERM',
        at: '2026-06-19T08:00:00.000Z',
      }).success,
    ).toBe(false);
    expect(
      hostObservationSchema.safeParse({
        type: 'process-exit',
        handleId: 'worker-1',
        at: '2026-06-19T08:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('AC-11 keeps host capability attestations compatible with committed w2-1 CapabilityAttestation', () => {
    const parsed = hostCapabilityAttestationSchema.parse(attestation());

    expect(w2CapabilityAttestationSchema.parse(parsed)).toEqual(parsed);
    expect(parsed.eventId).toBe('attestation-event-1');
    expect(getAttestedContainmentStrength(parsed)).toBe('kernel-tree');
    expect(getAttestedContainmentStrength(attestation('negative'))).toBeUndefined();
  });
});
