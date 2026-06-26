import type { Decision, PolicyGrantPlan } from '../contracts/index.js';

import type { ApprovalDecisionResult, DecideApprovalInput } from './types.js';
import {
  allowRuleForCommand,
  buildPolicyGrantPlan,
  defaultRequestedScope,
  hasPolicyProvenance,
  requestLinkageState,
} from './shared.js';

const buildDecision = (
  input: DecideApprovalInput,
  decisionId: string,
  overrides: Partial<Decision>,
  policyGrantPlan?: PolicyGrantPlan,
): Decision => {
  const sourceEventIds = [
    input.request.agentRequestEventId,
    ...(input.policySourceEventIds ?? []),
    ...(input.autoGrantGate !== undefined && input.autoGrantGate.status !== 'append-failed'
      ? [input.autoGrantGate.eventId]
      : []),
    ...(input.operatorDecisionEventId === undefined ? [] : [input.operatorDecisionEventId]),
  ];

  return {
    schema: 'kit-vnext.approval-decision.v1',
    decisionId,
    requestId: input.request.requestId,
    risk: input.risk,
    mode: input.mode,
    decision: 'blocked',
    decidedBy: 'system',
    sourceEventIds,
    policyRef: input.request.policyRef,
    reason: 'approval-policy-unavailable',
    decidedAt: input.evaluatedAt,
    ...(policyGrantPlan === undefined ? {} : { policyGrantPlan }),
    ...overrides,
  };
};

export const decideApproval = (input: DecideApprovalInput): ApprovalDecisionResult => {
  if (!hasPolicyProvenance(input.policy)) {
    return {
      ok: false,
      error: {
        failureState: 'approval-policy-unavailable',
        reason: 'Resolved policy or provenance is unavailable.',
      },
    };
  }

  const decisionId = input.ids();

  if (input.consultOrchestrator) {
    return {
      ok: true,
      value: {
        decision: buildDecision(input, decisionId, { decision: 'deny', reason: 'capability-deferred' }),
      },
    };
  }

  if (input.mode === 'manual') {
    return {
      ok: true,
      value: {
        decision: buildDecision(input, decisionId, { decision: 'human-required', reason: 'manual-mode' }),
      },
    };
  }

  if (input.risk === 'high') {
    return {
      ok: true,
      value: {
        decision: buildDecision(input, decisionId, { decision: 'human-required', reason: 'approval-risk-high' }),
        failureState: 'approval-risk-high',
      },
    };
  }

  const linkage = requestLinkageState(input.request, input.projections);
  if (!linkage.current) {
    return {
      ok: true,
      value: {
        decision: buildDecision(input, decisionId, { decision: 'blocked', reason: 'approval-session-ambiguous' }),
        failureState: 'approval-session-ambiguous',
      },
    };
  }

  const allowRule = allowRuleForCommand(input.policy, input.request.command);
  if (input.risk !== 'low' || allowRule === undefined) {
    return {
      ok: true,
      value: {
        decision: buildDecision(input, decisionId, {
          decision: 'human-required',
          reason: 'assisted-mode-human-review',
        }),
      },
    };
  }

  const requestedScope = defaultRequestedScope(input.request);
  if (requestedScope === 'session') {
    return {
      ok: true,
      value: {
        decision: buildDecision(input, decisionId, {
          decision: 'human-required',
          reason: 'session-scope-requires-human',
        }),
      },
    };
  }

  if (input.autoGrantGate === undefined) {
    return {
      ok: true,
      value: {
        decision: buildDecision(input, decisionId, { decision: 'human-required', reason: 'approval-gate-denied' }),
        failureState: 'approval-gate-denied',
      },
    };
  }

  if (input.autoGrantGate.status === 'append-failed') {
    return {
      ok: true,
      value: {
        decision: buildDecision(input, decisionId, { decision: 'blocked', reason: 'approval-gate-unwritable' }),
        failureState: 'approval-gate-unwritable',
      },
    };
  }

  if (
    input.autoGrantGate.record.capability !== 'escalation-auto-grant' ||
    input.autoGrantGate.record.scope.runId !== input.request.runId
  ) {
    return {
      ok: true,
      value: {
        decision: buildDecision(input, decisionId, { decision: 'human-required', reason: 'approval-gate-denied' }),
        failureState: 'approval-gate-denied',
      },
    };
  }

  if (input.autoGrantGate.status === 'deny' || input.autoGrantGate.record.decision === 'deny') {
    return {
      ok: true,
      value: {
        decision: buildDecision(input, decisionId, { decision: 'human-required', reason: 'approval-gate-denied' }),
        failureState: 'approval-gate-denied',
      },
    };
  }

  const policyGrantPlan = buildPolicyGrantPlan({
    request: input.request,
    policy: input.policy,
    matchedRule: allowRule,
    ids: input.ids,
    evaluatedAt: input.evaluatedAt,
  });

  if (policyGrantPlan === undefined) {
    return {
      ok: true,
      value: {
        decision: buildDecision(input, decisionId, {
          decision: 'deny',
          deniedScope: requestedScope,
          reason: 'approval-grant-mapping-invalid',
        }),
      },
    };
  }

  return {
    ok: true,
    value: {
      decision: buildDecision(
        input,
        decisionId,
        {
          decision: 'grant',
          decidedBy: 'policy',
          capabilityGateEventId: input.autoGrantGate.eventId,
          reason: 'allowlisted-low-risk-command',
        },
        policyGrantPlan,
      ),
      policyGrantPlan,
      matchedRule: allowRule,
    },
  };
};
