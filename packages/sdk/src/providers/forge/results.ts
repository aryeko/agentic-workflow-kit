import type { ForgeObservedFacts } from './observed-facts.js';
import type { ForgeFailureToken } from './types.js';

interface ForgeActionResultBase {
  readonly redactionFingerprintIds: readonly string[];
  readonly credentialAuditEventIds: readonly string[];
  readonly evidenceRef: string;
  readonly at: string;
}

export interface ForgeAcceptedActionResult extends ForgeActionResultBase {
  readonly kind: 'accepted';
  readonly observedHeadSha: string;
}

export interface ForgeRefusedActionResult extends ForgeActionResultBase {
  readonly kind: 'refused';
  readonly token: ForgeFailureToken;
  readonly observedHeadSha: string;
}

export interface ForgeDegraded extends ForgeActionResultBase {
  readonly kind: 'degraded';
  readonly token: ForgeFailureToken;
  readonly observedHeadSha?: string;
  readonly observedFacts?: ForgeObservedFacts;
}

export type ForgeActionResult = ForgeAcceptedActionResult | ForgeRefusedActionResult | ForgeDegraded;
