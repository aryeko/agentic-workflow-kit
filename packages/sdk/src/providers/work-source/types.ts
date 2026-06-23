import type { ArtifactRef } from '../../foundation/storage/artifacts/index.js';
import type { CapabilityAttestation } from '../attestation/index.js';

export type StatusBucket = 'eligible' | 'inProgress' | 'complete' | 'blocked' | 'unknown';

export type StatusBuckets = Record<Exclude<StatusBucket, 'unknown'>, string[]>;

export type WorkSourceCapability = 'supportsTracks' | 'supportsClaim' | 'supportsStatusWrite' | 'supportsDependencies';

export interface WorkSourceProbeScope {
  readonly driverId: string;
  readonly driverVersion: string;
  readonly platform: string;
  readonly sourceKind: 'markdown' | 'mock';
  readonly freshnessKey: string;
  readonly capabilities: WorkSourceCapability[];
  readonly trackIds?: string[];
  readonly at: string;
}

export interface TaskKey {
  readonly workSourceId: string;
  readonly trackId: string;
  readonly taskId: string;
}

export interface SpecRef {
  readonly kind: 'path' | 'url';
  readonly ref: string;
  readonly label?: string;
  readonly declaredDigest?: string;
}

export interface TaskStatus {
  readonly native: string;
  readonly bucket: StatusBucket;
}

export interface Claim {
  readonly runId: string;
  readonly holder: string;
  readonly claimedAt: string;
  readonly expiresAt: string;
  readonly epoch: number;
}

export interface TaskView {
  readonly key: TaskKey;
  readonly title: string;
  readonly status: TaskStatus;
  readonly target: { readonly project: string };
  readonly spec: { readonly inline?: string; readonly refs: SpecRef[] };
  readonly dependencies: TaskKey[];
  readonly claim?: Claim;
  readonly sourceRecordDigest: string;
}

export interface TrackView {
  readonly trackId: string;
  readonly workSourceId: string;
  readonly statusBuckets: StatusBuckets;
  readonly taskKeys: TaskKey[];
  readonly sourceRecordDigest: string;
}

export interface TaskSnapshot {
  readonly task: TaskView;
  readonly sourcePath: string;
  readonly sourceRevision: string;
  readonly sourceBytesDigest: string;
  readonly inlineSpecDigest?: string;
  readonly rawExcerptDigest: string;
  readonly createdAt: string;
}

export interface ClaimResult {
  readonly task: TaskView;
  readonly snapshotRef: ArtifactRef;
  readonly snapshotDigest: string;
}

export interface AuditCitation {
  readonly runId: string;
  readonly taskSnapshotRef: string;
  readonly statusEvidenceRef?: string;
}

export interface StatusWriteResult {
  readonly written: boolean;
  readonly updatedRecordDigest: string;
  readonly evidenceRef?: ArtifactRef;
  readonly auditCitation?: AuditCitation;
  readonly at: string;
}

export type WorkSourceError =
  | { readonly kind: 'work-source-unavailable'; readonly message: string; readonly sourceRef?: string }
  | { readonly kind: 'track-malformed'; readonly trackId: string; readonly diagnostic: string }
  | {
      readonly kind: 'dependency-unresolved';
      readonly task: TaskKey;
      readonly dependency: TaskKey;
      readonly reason: 'missing' | 'malformed' | 'blocked' | 'unknown' | 'incomplete';
    }
  | { readonly kind: 'status-bucket-unknown'; readonly task: TaskKey; readonly nativeStatus: string }
  | {
      readonly kind: 'claim-conflict';
      readonly task: TaskKey;
      readonly expectedRecordDigest: string;
      readonly observedRecordDigest: string;
      readonly expectedEpoch?: number;
      readonly observedEpoch?: number;
    }
  | {
      readonly kind: 'claim-lock-unavailable';
      readonly task: TaskKey;
      readonly leaseKey: string;
      readonly priorClaim?: Claim;
    }
  | { readonly kind: 'snapshot-artifact-unavailable'; readonly task: TaskKey; readonly diagnostic: string }
  | { readonly kind: 'status-write-unavailable'; readonly task: TaskKey; readonly diagnostic: string }
  | {
      readonly kind: 'status-authority-conflict';
      readonly task: TaskKey;
      readonly expectedRecordDigest?: string;
      readonly observedRecordDigest: string;
    };

export interface WorkSourceProvider {
  probeCapabilities(scope: WorkSourceProbeScope): CapabilityAttestation<WorkSourceCapability>[];
  listTracks(): TrackView[] | WorkSourceError;
  listTasks(trackId: string): TaskView[] | WorkSourceError;
  nextEligible(input: { trackIds?: string[]; targetProject?: string }): TaskView | null | WorkSourceError;
  claim(input: {
    task: TaskKey;
    runId: string;
    holder: string;
    ttlMs: number;
    expectedRecordDigest: string;
    sourceRevision: string;
  }): ClaimResult | WorkSourceError;
  release(input: { task: TaskKey; runId: string; reason: string; expectedEpoch: number }): void | WorkSourceError;
  writeStatus(input: {
    task: TaskKey;
    status: TaskStatus;
    expectedRecordDigest: string;
    evidenceRef?: ArtifactRef;
    note?: string;
    auditCitation?: AuditCitation;
  }): StatusWriteResult | WorkSourceError;
}
