import { describe, expect, it } from 'vitest';
import type { CapabilityGateFailureReason } from '../../../../src/core/capability/evaluator/index.js';

import { assertNever } from './shared.js';

const describeFailureReason = (reason: CapabilityGateFailureReason): CapabilityGateFailureReason => {
  switch (reason) {
    case 'mode-disallows-capability':
    case 'policy-disallows-capability':
    case 'capability-deferred':
    case 'run-log-degraded':
    case 'required-evidence-absent':
    case 'required-evidence-ambiguous':
    case 'attestation-absent':
    case 'attestation-stale':
    case 'attestation-negative':
    case 'attestation-out-of-scope':
    case 'attestation-contradictory':
    case 'attestation-non-replayable':
    case 'self-report-only':
    case 'gate-record-unwritable':
      return reason;
    default:
      return assertNever(reason);
  }
};

describe('core-02-s2 failure reason union', () => {
  it('covers the closed 15-member failure union', () => {
    const reasons: readonly CapabilityGateFailureReason[] = [
      'mode-disallows-capability',
      'policy-disallows-capability',
      'capability-deferred',
      'run-log-degraded',
      'required-evidence-absent',
      'required-evidence-ambiguous',
      'attestation-absent',
      'attestation-stale',
      'attestation-negative',
      'attestation-out-of-scope',
      'attestation-contradictory',
      'attestation-non-replayable',
      'self-report-only',
      'gate-record-unwritable',
    ];

    expect(reasons.map(describeFailureReason)).toEqual(reasons);
  });
});
