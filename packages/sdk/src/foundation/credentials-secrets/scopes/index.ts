export type { CredentialRef } from '../refs/index.js';
export type {
  CredentialScope,
  CredentialScopeDenialReason,
  CredentialScopeValidationFailure,
  CredentialScopeValidationReport,
  CredentialScopeValidationResult,
  ValidateCredentialScopeUseContext,
} from './credential-scope-types.js';
export { createCredentialScope, validateCredentialScopeUse } from './validate-credential-scope.js';
