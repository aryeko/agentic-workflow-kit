import type { ExpectedHeadActionRequest } from './requests.js';
import type { ForgeAcceptedActionResult, ForgeRefusedActionResult } from './results.js';

type ExactHeadMatch<Expected extends string, Observed extends string> = [Expected] extends [Observed]
  ? [Observed] extends [Expected]
    ? true
    : false
  : false;

interface ExactHeadActionResultBase<Expected extends string, Observed extends string> {
  readonly request: ExpectedHeadActionRequest & { readonly expectedHeadSha: Expected };
  readonly observedHeadSha: Observed;
  readonly redactionFingerprintIds: readonly string[];
  readonly credentialAuditEventIds: readonly string[];
  readonly evidenceRef: string;
  readonly at: string;
}

export type AcceptedForgeActionInput<Expected extends string, Observed extends string> =
  ExactHeadMatch<Expected, Observed> extends true ? ExactHeadActionResultBase<Expected, Observed> : never;

export type ExpectedHeadActionOutcome<Expected extends string, Observed extends string> =
  ExactHeadMatch<Expected, Observed> extends true ? ForgeAcceptedActionResult : ForgeRefusedActionResult;

export function createAcceptedForgeActionResult<const Expected extends string, const Observed extends string>(
  input: AcceptedForgeActionInput<Expected, Observed>,
): ForgeAcceptedActionResult {
  return {
    kind: 'accepted',
    observedHeadSha: input.observedHeadSha,
    redactionFingerprintIds: input.redactionFingerprintIds,
    credentialAuditEventIds: input.credentialAuditEventIds,
    evidenceRef: input.evidenceRef,
    at: input.at,
  };
}

export function createExpectedHeadActionResult<const Expected extends string, const Observed extends string>(
  input: ExactHeadActionResultBase<Expected, Observed>,
): ExpectedHeadActionOutcome<Expected, Observed> {
  if ((input.request.expectedHeadSha as string) === (input.observedHeadSha as string)) {
    return createAcceptedForgeActionResult(
      input as AcceptedForgeActionInput<Expected, Observed>,
    ) as ExpectedHeadActionOutcome<Expected, Observed>;
  }

  return {
    kind: 'refused',
    token: 'forge-head-mismatch',
    observedHeadSha: input.observedHeadSha,
    redactionFingerprintIds: input.redactionFingerprintIds,
    credentialAuditEventIds: input.credentialAuditEventIds,
    evidenceRef: input.evidenceRef,
    at: input.at,
  } as unknown as ExpectedHeadActionOutcome<Expected, Observed>;
}
