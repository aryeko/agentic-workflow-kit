import type { RecoveryEvidenceSnapshot, RecoveryState } from '../contracts/index.js';
import type {
  DuplicateLaunchBlockedPayload,
  StaleLaunchClearanceRequestedPayload,
  StoryLaunchLeaseAcquiredPayload,
} from '../contracts/index.js';
import type {
  EvidenceEventRef,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunWriter,
} from '../../run-lifecycle/contracts/index.js';
import type { LeaseCapability, LeaseStore, StorageError, StorageHealth } from '../../../foundation/storage/index.js';

export type StoryLaunchKeyParts = {
  readonly workSourceId: string;
  readonly trackId: string;
  readonly taskId: string;
};

export type StoryLaunchFailureState = Extract<
  RecoveryState,
  'lease-unavailable' | 'launch-duplicate-active' | 'provider-evidence-gap' | 'manual-edits-forbidden'
>;

export type StoryLaunchRecordFailure = {
  readonly reason: 'event-log-unwritable';
  readonly appendFailure: RunAppendFailure;
};

export type StoryLaunchRecordResult<TPayload> = Result<
  {
    readonly payload: TPayload;
    readonly appendReceipt: RunAppendReceipt;
  },
  StoryLaunchRecordFailure
>;

export type AcquireStoryLaunchLeaseInput = StoryLaunchKeyParts & {
  readonly runId: string;
  readonly holder: string;
  readonly ttlMs: number;
  readonly acquiredAt: string;
  readonly sourceEventIds: readonly string[];
  readonly writer: RunWriter;
  readonly leaseStore: Pick<LeaseStore, 'acquire' | 'release'>;
};

export type AcquireStoryLaunchLeaseFailure =
  | {
      readonly reason: 'lease-store-unavailable';
      readonly failureState: Extract<StoryLaunchFailureState, 'lease-unavailable' | 'launch-duplicate-active'>;
      readonly storageError: StorageError;
    }
  | ({
      readonly leaseCapability: LeaseCapability;
    } & StoryLaunchRecordFailure);

export type AcquireStoryLaunchLeaseResult = Result<
  {
    readonly leaseCapability: LeaseCapability;
    readonly payload: StoryLaunchLeaseAcquiredPayload;
    readonly appendReceipt: RunAppendReceipt;
  },
  AcquireStoryLaunchLeaseFailure
>;

export type RecordDuplicateLaunchBlockedInput = {
  readonly runId: string;
  readonly storyLaunchKey: string;
  readonly incumbentLeaseEpoch: number;
  readonly blockedAt: string;
  readonly sourceEventIds: readonly string[];
  readonly writer?: RunWriter;
};

export type RecordDuplicateLaunchBlockedFailure =
  | {
      readonly reason: 'duplicate-launch-active';
      readonly failureState: Extract<StoryLaunchFailureState, 'launch-duplicate-active'>;
      readonly incumbentLeaseEpoch: number;
    }
  | StoryLaunchRecordFailure;

export type RecordDuplicateLaunchBlockedResult =
  | StoryLaunchRecordResult<DuplicateLaunchBlockedPayload>
  | {
      readonly ok: false;
      readonly error: RecordDuplicateLaunchBlockedFailure;
    };

export type RequestStaleLaunchClearanceInput = {
  readonly snapshot: RecoveryEvidenceSnapshot;
  readonly holder: string;
  readonly ttlMs: number;
  readonly requestedAt: string;
  readonly writer: RunWriter;
  readonly leaseStore: Pick<LeaseStore, 'acquire' | 'release'>;
};

export type RequestStaleLaunchClearanceFailure =
  | {
      readonly reason: 'lease-store-unavailable';
      readonly failureState: Extract<StoryLaunchFailureState, 'lease-unavailable' | 'launch-duplicate-active'>;
      readonly leaseHealth?: StorageHealth;
      readonly storageError?: StorageError;
    }
  | {
      readonly reason: 'provider-evidence-gap';
      readonly failureState: Extract<StoryLaunchFailureState, 'provider-evidence-gap'>;
      readonly missingEvidence: string;
    }
  | {
      readonly reason: 'duplicate-launch-active';
      readonly failureState: Extract<StoryLaunchFailureState, 'launch-duplicate-active'>;
      readonly blockingSignal: string;
    }
  | {
      readonly reason: 'manual-edits-forbidden';
      readonly failureState: Extract<StoryLaunchFailureState, 'manual-edits-forbidden'>;
      readonly evidenceRefs: readonly EvidenceEventRef[];
    }
  | ({
      readonly leaseCapability: LeaseCapability;
    } & StoryLaunchRecordFailure);

export type RequestStaleLaunchClearanceResult = Result<
  {
    readonly leaseCapability: LeaseCapability;
    readonly payload: StaleLaunchClearanceRequestedPayload;
    readonly appendReceipt: RunAppendReceipt;
  },
  RequestStaleLaunchClearanceFailure
>;
