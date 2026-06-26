import { describe, expect, it } from 'vitest';

import type {
  ApprovalMode,
  ApprovalRisk,
  ApprovalState,
  ApprovalSubject,
  PolicyGrantScope,
} from '../../../../src/index.js';

import { approvalModes, approvalRisks, failureStates, policyGrantScopes } from './fixtures.js';

describe('core-03-s1 approval unions', () => {
  it('declares the v1 mode and risk unions exactly', () => {
    const modes: readonly ApprovalMode[] = approvalModes;
    const risks: readonly ApprovalRisk[] = approvalRisks;

    expect(modes).toEqual(['manual', 'assisted']);
    expect(risks).toEqual(['low', 'medium', 'high']);
  });

  it('declares the policy scopes and approval subjects exactly once', () => {
    const scopes: readonly PolicyGrantScope[] = policyGrantScopes;
    const subjects: readonly ApprovalSubject[] = [
      'command',
      'file-change',
      'permission',
      'network',
      'input',
      'protected-policy-change',
      'other',
    ];

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
