import { describe, expect, it } from 'vitest';

import type {
  DecideApprovalInput,
  ApprovalRiskClassificationInput,
  RecordApprovalDecisionInput,
  RecordApprovalRiskClassifiedInput,
} from 'sdk';
import {
  classifyApprovalRisk,
  decideApproval,
  normalizeApprovalRequest,
  recordApprovalDecision,
  recordApprovalRiskClassified,
} from 'sdk';

import {
  allowGate,
  createAgentRequest,
  createBaseReplay,
  createClassification,
  createContext,
  createDecision,
  createIdGenerator,
  createPolicy,
  createProjections,
  createRequest,
  createWriter,
  evaluatedAt,
} from './shared.js';

describe('core-03-s2 public sdk approval decision imports', () => {
  it('exports normalize, classify, record, and decide through sdk', async () => {
    const normalized = normalizeApprovalRequest(createAgentRequest(), createContext());

    const classifyInput: ApprovalRiskClassificationInput = {
      request: createRequest(),
      policy: createPolicy(),
      replay: createBaseReplay(),
      projections: createProjections(),
      classifiedAt: evaluatedAt,
      requestEvidenceRefs: ['evidence:request-01'],
    };
    const classification = classifyApprovalRisk(classifyInput);

    const riskRecordInput: RecordApprovalRiskClassifiedInput = {
      requestId: 'request-01',
      classification: createClassification(),
    };
    const riskRecord = await recordApprovalRiskClassified(riskRecordInput, createWriter());

    const decisionInput: DecideApprovalInput = {
      request: createRequest(),
      risk: 'low',
      mode: 'assisted',
      policy: createPolicy(),
      replay: createBaseReplay(),
      projections: createProjections(),
      evaluatedAt,
      ids: createIdGenerator('decision-01', 'grant-01'),
      autoGrantGate: allowGate(),
    };
    const decision = decideApproval(decisionInput);

    const recordDecisionInput: RecordApprovalDecisionInput = {
      request: createRequest(),
      decision: createDecision(),
      sourceEventIds: ['evt-agent-request-01', 'evt-risk-01'],
      capabilityGateEventId: 'evt-gate-allow-01',
    };
    const decisionRecord = await recordApprovalDecision(recordDecisionInput, createWriter());

    expect(normalized.worktreePath).toBe('/workspace/story');
    expect(classification.ok).toBe(true);
    expect(riskRecord.ok).toBe(true);
    expect(decision.ok).toBe(true);
    expect(decisionRecord.ok).toBe(true);
  });
});
