import type { ScopedGrant } from '../../../providers/agent/index.js';
import type { Result } from '../../run-lifecycle/contracts/index.js';

import type { ApprovalRequest, PolicyGrantPlan } from '../contracts/index.js';
import { defaultRequestedScope, isScopeBroaderThan } from '../decision/policy-helpers.js';

import type { ApprovalGrantMappingFailure, ApprovalGrantMappingResult, MapPolicyGrantInput } from './types.js';

const invalid = (reason: string): ApprovalGrantMappingResult => ({
  ok: false,
  error: { failureState: 'approval-grant-mapping-invalid', reason },
});

export const mapPolicyGrantToScopedGrant = (input: MapPolicyGrantInput): ApprovalGrantMappingResult => {
  if (input.deny !== undefined) {
    return mapDeny(input.deny.disposition, input.deny.reason, input.decisionEventId);
  }

  if (input.grantPlan === undefined) {
    return invalid('grant plan is required');
  }

  if (isScopeBroaderThan(input.grantPlan.scope, defaultRequestedScope(input.request))) {
    return invalid('grant plan scope must not widen requested approval scope');
  }

  const mapper = scopeMappers[input.grantPlan.scope];
  return mapper(input.request, input.grantPlan, input.decisionEventId, input.humanApproved === true);
};

const mapDeny = (
  disposition: 'continue' | 'interrupt' | 'park',
  reason: string,
  decisionEventId: string,
): ApprovalGrantMappingResult => {
  if (reason.trim() === '') {
    return invalid('deny disposition requires denial reason content');
  }

  return {
    ok: true,
    value: {
      grantId: `deny-${decisionEventId}`,
      kind: `deny-${disposition}`,
      scope: 'request',
      content: { reason },
      grantEventId: decisionEventId,
    },
  };
};

const mapPerCommand = (
  request: ApprovalRequest,
  plan: PolicyGrantPlan,
  decisionEventId: string,
): ApprovalGrantMappingResult => {
  const command = plan.command ?? request.command;
  if (command === undefined || request.command === undefined) {
    return invalid('per-command requires exact command evidence');
  }

  if (command !== request.command) {
    return invalid('per-command plan must equal recorded command evidence');
  }

  return okGrant({
    grantId: plan.grantId,
    kind: 'command-once',
    scope: 'request',
    command,
    grantEventId: decisionEventId,
  });
};

const mapPerCommandPrefix = (
  request: ApprovalRequest,
  plan: PolicyGrantPlan,
  decisionEventId: string,
): ApprovalGrantMappingResult => {
  const prefixValidation = validateCommandPrefix(plan.commandPrefix);
  if (!prefixValidation.ok) {
    return prefixValidation;
  }
  if (!commandMatchesPrefix(request.command, prefixValidation.value)) {
    return invalid('per-command-prefix evidence must match recorded command evidence');
  }

  return okGrant({
    grantId: plan.grantId,
    kind: 'command-policy-amendment',
    scope: 'turn',
    commandPrefix: [...prefixValidation.value],
    grantEventId: decisionEventId,
  });
};

const mapPerHost = (
  request: ApprovalRequest,
  plan: PolicyGrantPlan,
  decisionEventId: string,
): ApprovalGrantMappingResult => {
  const host = plan.host ?? request.host;
  if (host === undefined || request.host === undefined) {
    return invalid('per-host requires exact host evidence');
  }

  if (host !== request.host || host.trim() === '' || host.includes('*')) {
    return invalid('per-host grant must use one exact recorded host');
  }

  return okGrant({
    grantId: plan.grantId,
    kind: 'network-permission',
    scope: 'turn',
    networkHost: host,
    networkAction: 'allow',
    grantEventId: decisionEventId,
  });
};

const mapSession = (
  request: ApprovalRequest,
  plan: PolicyGrantPlan,
  decisionEventId: string,
  humanApproved: boolean,
): ApprovalGrantMappingResult => {
  if (!humanApproved) {
    return invalid('session grants require human approval');
  }

  if (plan.sessionId === undefined || plan.sessionId !== request.sessionId) {
    return invalid('session grants require current sessionId evidence');
  }

  if (request.subject === 'file-change') {
    return mapFileChangeSession(request, plan, decisionEventId);
  }

  const command = plan.command ?? request.command;
  if (command === undefined || request.command === undefined) {
    return invalid('command session grants require command evidence');
  }

  const prefixValidation =
    command === request.command ? undefined : validateCommandPrefix(plan.commandPrefix, 'command session');
  if (prefixValidation !== undefined && !prefixValidation.ok) {
    return prefixValidation;
  }
  if (prefixValidation?.ok === true && !commandMatchesPrefix(request.command, prefixValidation.value)) {
    return invalid('command session prefix evidence must match recorded command evidence');
  }

  return okGrant({
    grantId: plan.grantId,
    kind: 'command-session',
    scope: 'session',
    ...(prefixValidation?.ok === true ? { commandPrefix: [...prefixValidation.value] } : { command }),
    grantEventId: decisionEventId,
  });
};

const mapFileChangeSession = (
  request: ApprovalRequest,
  plan: PolicyGrantPlan,
  decisionEventId: string,
): ApprovalGrantMappingResult => {
  if (request.filePaths === undefined || request.filePaths.length === 0) {
    return invalid('file-change session grants require bounded file path evidence');
  }

  if (!request.filePaths.every(isBoundedRelativePath)) {
    return invalid('file-change session grants require bounded file path evidence');
  }

  return okGrant({
    grantId: plan.grantId,
    kind: 'file-change-session',
    scope: 'session',
    filePaths: [...request.filePaths],
    grantEventId: decisionEventId,
  });
};

// Approval file paths are POSIX-style relative paths at the approval contract boundary.
const isBoundedRelativePath = (value: string): boolean =>
  value.trim() !== '' && !value.startsWith('/') && !value.split('/').includes('..');

const validateCommandPrefix = (
  commandPrefix: PolicyGrantPlan['commandPrefix'],
  context = 'per-command-prefix',
): Result<readonly string[], ApprovalGrantMappingFailure> => {
  if (commandPrefix === undefined || commandPrefix.length === 0) {
    return invalidPrefix(`${context} requires policy commandPrefix evidence`);
  }

  if (commandPrefix.some((part) => part.trim() === '')) {
    return invalidPrefix(`${context} evidence must be non-empty argv parts`);
  }

  return { ok: true, value: commandPrefix };
};

const invalidPrefix = (reason: string): Result<readonly string[], ApprovalGrantMappingFailure> => ({
  ok: false,
  error: { failureState: 'approval-grant-mapping-invalid', reason },
});

const commandMatchesPrefix = (command: string | undefined, commandPrefix: readonly string[]): boolean => {
  if (command === undefined) {
    return false;
  }
  const prefix = commandPrefix.join(' ');
  return command === prefix || command.startsWith(`${prefix} `);
};

const okGrant = (grant: ScopedGrant): ApprovalGrantMappingResult => ({ ok: true, value: grant });

const scopeMappers = {
  'per-command': mapPerCommand,
  'per-command-prefix': mapPerCommandPrefix,
  'per-host': mapPerHost,
  session: mapSession,
} satisfies Record<
  PolicyGrantPlan['scope'],
  (
    request: ApprovalRequest,
    plan: PolicyGrantPlan,
    decisionEventId: string,
    humanApproved: boolean,
  ) => ApprovalGrantMappingResult
>;
