import type { StorageHealth } from '../../../foundation/storage/index.js';

import type { RunAppendFailureCode } from './failure-codes.js';
import type { RunLifecycleState } from './result.js';

export type RunCreatedPayload = {
  idempotencyKey: string;
  operatorRef?: string;
  requestedBy: string;
};

export type RunPolicyBoundPayload = {
  policyDigest: string;
  provenanceRef: string;
  profile?: string;
};

export type TaskSnapshotRecordedPayload = {
  taskId: string;
  sourceRef: string;
  snapshotDigest: string;
};

export type RunLifecycleTransitionPayload = {
  from: RunLifecycleState | null;
  to: RunLifecycleState;
  reason: string;
  authority: 'operator' | 'policy' | 'system' | 'recovery';
  sourceEventIds: string[];
  terminal?: boolean;
};

export type SessionLinkedPayload = {
  linkOrdinal: number;
  sessionId: string;
  linkRole: 'primary' | 'recovery' | 'observer';
  startedAt: string;
  sourceEventId: string;
  supersedesOrdinal?: number;
};

export type SessionLinkSupersededPayload = {
  supersededOrdinal: number;
  replacementOrdinal: number;
  reason: string;
  sourceEventId: string;
};

export type RunAppendRejectedPayload = {
  attemptedEventId?: string;
  attemptedType: string;
  attemptedDomain: string;
  failureCode: RunAppendFailureCode;
  expectedSequence?: number;
  observedSequence?: number;
  writerEpoch?: number;
  recordedReason: string;
};

export type RunLogTailRepairedPayload = {
  repairedAt: string;
  lastCommittedSequence: number;
  quarantinedBytes: number;
  storageHealth: Extract<StorageHealth, 'log-tail-repaired'>;
};
