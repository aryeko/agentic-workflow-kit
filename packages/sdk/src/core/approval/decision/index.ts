export { classifyApprovalRisk } from './classify-approval-risk.js';
export { decideApproval } from './decide-approval.js';
export { normalizeApprovalRequest } from './normalize-approval-request.js';
export { recordApprovalDecision } from './record-approval-decision.js';
export { recordApprovalRiskClassified } from './record-approval-risk-classified.js';
export type {
  ApprovalAutoGrantGate,
  ApprovalDecisionComputation,
  ApprovalDecisionFailure,
  ApprovalDecisionIdGenerator,
  ApprovalDecisionRecordCommit,
  ApprovalDecisionRecordFailure,
  ApprovalDecisionRecordResult,
  ApprovalDecisionResult,
  ApprovalRecordIntent,
  ApprovalRecordWriter,
  ApprovalRiskClassification,
  ApprovalRiskClassificationFailure,
  ApprovalRiskClassificationInput,
  ApprovalRiskClassificationResult,
  ApprovalRiskRecordCommit,
  ApprovalRiskRecordFailure,
  ApprovalRiskRecordResult,
  DecideApprovalInput,
  RecordApprovalDecisionInput,
  RecordApprovalRiskClassifiedInput,
} from './types.js';
