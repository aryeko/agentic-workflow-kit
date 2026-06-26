import { describe, expect, it } from 'vitest';

import type {
  ApprovalMode,
  ApprovalRisk,
  ApprovalState,
  ApprovalSubject,
  PolicyGrantScope,
} from '../../../../src/index.js';

import { approvalModes, approvalRisks, approvalSubjects, failureStates, policyGrantScopes } from './fixtures.js';

const assertNever = (value: never): never => {
  throw new Error(`Unhandled approval union member: ${String(value)}`);
};

const describeApprovalMode = (mode: ApprovalMode): string => {
  switch (mode) {
    case 'manual':
      return 'manual';
    case 'assisted':
      return 'assisted';
    default:
      return assertNever(mode);
  }
};

const describeApprovalRisk = (risk: ApprovalRisk): string => {
  switch (risk) {
    case 'low':
      return 'low';
    case 'medium':
      return 'medium';
    case 'high':
      return 'high';
    default:
      return assertNever(risk);
  }
};

const describePolicyGrantScope = (scope: PolicyGrantScope): string => {
  switch (scope) {
    case 'per-command':
      return 'per-command';
    case 'per-command-prefix':
      return 'per-command-prefix';
    case 'per-host':
      return 'per-host';
    case 'session':
      return 'session';
    default:
      return assertNever(scope);
  }
};

const describeApprovalSubject = (subject: ApprovalSubject): string => {
  switch (subject) {
    case 'command':
      return 'command';
    case 'file-change':
      return 'file-change';
    case 'permission':
      return 'permission';
    case 'network':
      return 'network';
    case 'input':
      return 'input';
    case 'protected-policy-change':
      return 'protected-policy-change';
    case 'other':
      return 'other';
    default:
      return assertNever(subject);
  }
};

describe('core-03-s1 approval unions', () => {
  it('declares the v1 mode and risk unions exactly', () => {
    const modes = approvalModes.map(describeApprovalMode);
    const risks = approvalRisks.map(describeApprovalRisk);

    expect(modes).toEqual(['manual', 'assisted']);
    expect(risks).toEqual(['low', 'medium', 'high']);
  });

  it('declares the policy scopes and approval subjects exactly once', () => {
    const scopes = policyGrantScopes.map(describePolicyGrantScope);
    const subjects = approvalSubjects.map(describeApprovalSubject);

    expect(scopes).toEqual(['per-command', 'per-command-prefix', 'per-host', 'session']);
    expect(subjects).toContain('protected-policy-change');
    expect(subjects).toContain('network');
  });

  it('keeps the approval state and failure catalog exhaustive', () => {
    const states: readonly ApprovalState[] = [
      'pending',
      'auto-granted',
      'human-required',
      'answered',
      'denied',
      'parked',
      'resumed',
      'expired',
      'blocked',
      'failed',
    ];

    expect(states).toHaveLength(10);
    expect(failureStates).toHaveLength(13);
    expect(failureStates).toContain('approval-grant-mapping-invalid');
  });
});
