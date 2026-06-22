import { createCredentialUseDenied } from '../audit/create-audit-events.js';
import type { AuditHashDependencies, AuditSeed, CredentialUseDenied } from '../audit/audit-types.js';
import type { CredentialDenied } from './failure-types.js';
import type { CredentialDenialReason } from './denial-reasons.js';

export function createCredentialDenied(auditEvent: CredentialUseDenied): CredentialDenied;
export function createCredentialDenied(
  reason: CredentialDenialReason,
  auditEvent: CredentialUseDenied,
): CredentialDenied;
export function createCredentialDenied(
  reasonOrAuditEvent: CredentialDenialReason | CredentialUseDenied,
  maybeAuditEvent?: CredentialUseDenied,
): CredentialDenied {
  const auditEvent = maybeAuditEvent ?? reasonOrAuditEvent;
  if (typeof auditEvent === 'string') {
    throw new TypeError('Credential denial audit event is required.');
  }

  if (typeof reasonOrAuditEvent === 'string' && reasonOrAuditEvent !== auditEvent.reason) {
    throw new Error(
      `Credential denial reason mismatch: ${reasonOrAuditEvent} does not match audit event reason ${auditEvent.reason}.`,
    );
  }

  return {
    ok: false,
    reason: auditEvent.reason,
    auditEvent,
  };
}

export const denyAuditWriteUnavailable = (
  input: {
    readonly audit: AuditSeed;
  },
  dependencies: AuditHashDependencies,
): CredentialDenied =>
  createCredentialDenied(
    'audit-write-unavailable',
    createCredentialUseDenied(
      {
        audit: input.audit,
        reason: 'audit-write-unavailable',
      },
      dependencies,
    ),
  );
