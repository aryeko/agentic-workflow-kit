import { stableHash } from '@kit-vnext/foundation-fnd-01';
import type { CredentialAuditEvent } from './types.js';

export const CREDENTIAL_AUDIT_GENESIS_HASH = stableHash({
  domain: 'fnd-04',
  type: 'credential-audit-genesis',
});

export const credentialAuditEventHash = (event: CredentialAuditEvent): string => {
  const { eventHash, ...payload } = event;
  void eventHash;
  return stableHash(payload);
};

export const withCredentialAuditHash = <T extends Omit<CredentialAuditEvent, 'eventHash'>>(
  event: T,
): T & { readonly eventHash: string } => {
  const eventWithPlaceholder = { ...event, eventHash: '' } as unknown as CredentialAuditEvent;
  return { ...event, eventHash: credentialAuditEventHash(eventWithPlaceholder) };
};
