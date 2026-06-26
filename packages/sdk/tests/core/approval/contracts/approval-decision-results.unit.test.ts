import { describe, expect, it } from 'vitest';

import type {
  ApprovalParkInput,
  ApprovalResumeInput,
  Decision,
  Outcome,
  ParkDecision,
  ResumeDecision,
} from '../../../../src/index.js';

import {
  decisionFixture,
  outcomeFixture,
  parkDecisionFixture,
  parkInputFixture,
  resumeDecisionFixture,
  resumeInputFixture,
} from './fixtures.js';

describe('core-03-s1 decision and result contracts', () => {
  it('defines exact schema literals for decision, outcome, park, and resume values', () => {
    const decision: Decision = decisionFixture();
    const outcome: Outcome = outcomeFixture();
    const parkInput: ApprovalParkInput = parkInputFixture();
    const parkDecision: ParkDecision = parkDecisionFixture();
    const resumeInput: ApprovalResumeInput = resumeInputFixture();
    const resumeDecision: ResumeDecision = resumeDecisionFixture();

    expect(decision.schema).toBe('kit-vnext.approval-decision.v1');
    expect(outcome.schema).toBe('kit-vnext.approval-outcome.v1');
    expect(parkInput.sourceEventIds).toEqual(['evt-requested-01', 'evt-decision-01']);
    expect(parkDecision.schema).toBe('kit-vnext.approval-park-decision.v1');
    expect(parkDecision.sourceEventIds).toEqual(['evt-requested-01', 'evt-decision-01']);
    expect(resumeInput.decisionEventId).toBe('evt-decision-01');
    expect(resumeDecision.schema).toBe('kit-vnext.approval-resume-decision.v1');
    expect(resumeDecision.outcome).toBe('resume');
  });

  it('allows only the v1 resume outcomes', () => {
    const outcomes: readonly ResumeDecision['outcome'][] = ['resume', 'expired', 'blocked'];

    expect(outcomes).toEqual(['resume', 'expired', 'blocked']);
  });
});
