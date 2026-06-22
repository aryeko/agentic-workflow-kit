import type { CredentialUseDenied } from '../audit/audit-types.js';
import type { CredentialDenialReason } from './denial-reasons.js';

export type CredentialDenied = {
  readonly ok: false;
  readonly reason: CredentialDenialReason;
  readonly auditEvent: CredentialUseDenied;
};
