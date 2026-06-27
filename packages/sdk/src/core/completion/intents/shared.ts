import type {
  AppendIntent,
  EvidenceEventRef,
  Result,
  RunAppendFailure,
  RunAppendReceipt,
  RunWriter,
} from '../../run-lifecycle/contracts/index.js';
import { dedupeEvidenceEventRefs } from '../contracts/evidence-refs.js';

import type { ExactHeadEvidence } from './types.js';

export const uniqueEvidenceRefs = (refs: readonly EvidenceEventRef[]): readonly EvidenceEventRef[] =>
  dedupeEvidenceEventRefs(refs);

export const appendBarrierIntent = async <TPayload>(
  writer: RunWriter,
  type: string,
  occurredAt: string,
  payload: TPayload,
): Promise<Result<RunAppendReceipt, RunAppendFailure>> => {
  const appendIntent: AppendIntent<TPayload> = {
    domain: 'core-05',
    type,
    durability: 'barrier',
    payload,
    occurredAt,
  };

  return Promise.resolve(writer.append([appendIntent]));
};

export const resolveExactHead = <TAmbiguous extends 'head-ambiguous' | 'merge-head-ambiguous'>(
  expectedHeadSha: string | undefined,
  localHead: ExactHeadEvidence,
  ambiguousToken: TAmbiguous,
): { ok: true; expectedHeadSha: string } | { ok: false; token: TAmbiguous | 'workspace-dirty' } => {
  if (!localHead.clean) {
    return { ok: false, token: 'workspace-dirty' };
  }

  if (expectedHeadSha === undefined || expectedHeadSha.length === 0) {
    return { ok: false, token: ambiguousToken };
  }

  if (localHead.headSha === undefined || localHead.headSha.length === 0) {
    return { ok: false, token: ambiguousToken };
  }

  if (localHead.headSha !== expectedHeadSha) {
    return { ok: false, token: ambiguousToken };
  }

  return { ok: true, expectedHeadSha };
};
