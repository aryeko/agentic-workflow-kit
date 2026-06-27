import type { ReconciliationBlockedPayload, RecoveryClassifiedPayload } from '../contracts/index.js';
import type { Result, RunAppendFailure, RunAppendReceipt, RunWriter } from '../../run-lifecycle/contracts/index.js';

export interface RecordReconciliationBlockedInput {
  readonly classified: RecoveryClassifiedPayload;
  readonly parkedReason: string;
  readonly severity: ReconciliationBlockedPayload['severity'];
  readonly blockedAt: string;
  readonly writer: RunWriter;
  readonly causationId?: string;
}

export interface ReconciliationBlockedRecord {
  readonly payload: ReconciliationBlockedPayload;
  readonly appendReceipt: RunAppendReceipt;
  readonly eventId: string;
}

export interface RecordReconciliationBlockedFailure {
  readonly reason: 'log-unwritable';
  readonly phase: 'apply';
  readonly appendFailure: RunAppendFailure;
}

export type RecordReconciliationBlockedResult = Result<ReconciliationBlockedRecord, RecordReconciliationBlockedFailure>;
