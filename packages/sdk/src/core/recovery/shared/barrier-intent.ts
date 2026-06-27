import type { AppendIntent } from '../../run-lifecycle/contracts/index.js';

export const buildRecoveryBarrierIntent = <TPayload>(
  type: string,
  payload: TPayload,
  occurredAt: string,
  causationId?: string,
): AppendIntent<TPayload> => ({
  domain: 'core-06',
  type,
  durability: 'barrier',
  payload,
  occurredAt,
  ...(causationId === undefined ? {} : { causationId }),
});
