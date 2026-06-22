import type {
  ApprovalPolicy,
  CapabilityPolicy,
  CapabilitySetting,
  ChangePolicy,
  CredentialReferencePolicy,
  DeepPartial,
  EscalationPolicy,
  ProvisioningPolicy,
  RunPolicy,
} from './types.js';
import {
  hasOwn,
  validateBoolean,
  validateEnumValue,
  validateFullSet,
  validateNumber,
  validatePartialSet,
  validateStringArray,
  isPlainObject,
} from './validation-primitives.js';

export const validateRunPolicy = (
  value: unknown,
  path: string,
  issues: string[],
  required: boolean,
): value is RunPolicy | DeepPartial<RunPolicy> => {
  if (value === undefined) {
    if (required) {
      issues.push(`${path} is required`);
    }

    return !required;
  }

  if (!isPlainObject(value)) {
    issues.push(`${path} must be an object`);
    return false;
  }

  if (!validateFullSet(value, ['mode', 'maxConcurrentRuns', 'requireCleanWorkspace'], path, issues)) {
    return false;
  }

  if (hasOwn(value, 'mode') && !validateEnumValue(value.mode, `${path}.mode`, ['manual', 'assisted'], issues)) {
    return false;
  }

  if (
    hasOwn(value, 'maxConcurrentRuns') &&
    (!validateNumber(value.maxConcurrentRuns, `${path}.maxConcurrentRuns`, issues) ||
      !Number.isInteger(value.maxConcurrentRuns) ||
      value.maxConcurrentRuns < 0)
  ) {
    issues.push(`${path}.maxConcurrentRuns must be a non-negative integer`);
    return false;
  }

  if (
    hasOwn(value, 'requireCleanWorkspace') &&
    !validateBoolean(value.requireCleanWorkspace, `${path}.requireCleanWorkspace`, issues)
  ) {
    return false;
  }

  if (required) {
    return hasOwn(value, 'mode') && hasOwn(value, 'maxConcurrentRuns') && hasOwn(value, 'requireCleanWorkspace');
  }

  return true;
};

export const validateProvisioningPolicy = (
  value: unknown,
  path: string,
  issues: string[],
  required: boolean,
): value is ProvisioningPolicy | DeepPartial<ProvisioningPolicy> => {
  if (value === undefined) {
    if (required) {
      issues.push(`${path} is required`);
    }

    return !required;
  }

  if (!isPlainObject(value)) {
    issues.push(`${path} must be an object`);
    return false;
  }

  if (!validateFullSet(value, ['ownershipClass', 'containmentRequired', 'dependencyInstall'], path, issues)) {
    return false;
  }

  if (
    hasOwn(value, 'ownershipClass') &&
    !validateEnumValue(
      value.ownershipClass,
      `${path}.ownershipClass`,
      ['owned', 'owned-remote', 'observe-only'],
      issues,
    )
  ) {
    return false;
  }

  if (
    hasOwn(value, 'containmentRequired') &&
    !validateBoolean(value.containmentRequired, `${path}.containmentRequired`, issues)
  ) {
    return false;
  }

  if (hasOwn(value, 'dependencyInstall')) {
    const dependencyInstall = value.dependencyInstall;
    if (!isPlainObject(dependencyInstall)) {
      issues.push(`${path}.dependencyInstall must be an object`);
      return false;
    }

    if (
      !validatePartialSet(dependencyInstall, ['defaultGrant', 'allowedPrefixes'], `${path}.dependencyInstall`, issues)
    ) {
      return false;
    }

    if (
      hasOwn(dependencyInstall, 'defaultGrant') &&
      !validateEnumValue(
        dependencyInstall.defaultGrant,
        `${path}.dependencyInstall.defaultGrant`,
        ['none', 'narrow'],
        issues,
      )
    ) {
      return false;
    }

    if (
      hasOwn(dependencyInstall, 'allowedPrefixes') &&
      !validateStringArray(dependencyInstall.allowedPrefixes, `${path}.dependencyInstall.allowedPrefixes`, issues)
    ) {
      return false;
    }
  }

  if (required) {
    return (
      hasOwn(value, 'ownershipClass') && hasOwn(value, 'containmentRequired') && hasOwn(value, 'dependencyInstall')
    );
  }

  return true;
};

export const validateApprovalPolicy = (
  value: unknown,
  path: string,
  issues: string[],
  required: boolean,
): value is ApprovalPolicy | DeepPartial<ApprovalPolicy> => {
  if (value === undefined) {
    if (required) {
      issues.push(`${path} is required`);
    }

    return !required;
  }

  if (!isPlainObject(value)) {
    issues.push(`${path} must be an object`);
    return false;
  }

  if (
    !validateFullSet(value, ['mode', 'parkOnHumanLatency', 'requireRecordedDecision', 'decisionWindowMs'], path, issues)
  ) {
    return false;
  }

  if (hasOwn(value, 'mode') && !validateEnumValue(value.mode, `${path}.mode`, ['manual', 'assisted'], issues)) {
    return false;
  }

  if (
    hasOwn(value, 'parkOnHumanLatency') &&
    !validateBoolean(value.parkOnHumanLatency, `${path}.parkOnHumanLatency`, issues)
  ) {
    return false;
  }

  if (
    hasOwn(value, 'requireRecordedDecision') &&
    !validateBoolean(value.requireRecordedDecision, `${path}.requireRecordedDecision`, issues)
  ) {
    return false;
  }

  if (
    hasOwn(value, 'decisionWindowMs') &&
    (!validateNumber(value.decisionWindowMs, `${path}.decisionWindowMs`, issues) ||
      !Number.isInteger(value.decisionWindowMs) ||
      value.decisionWindowMs < 0)
  ) {
    issues.push(`${path}.decisionWindowMs must be a non-negative integer`);
    return false;
  }

  if (required) {
    return (
      hasOwn(value, 'mode') &&
      hasOwn(value, 'parkOnHumanLatency') &&
      hasOwn(value, 'requireRecordedDecision') &&
      hasOwn(value, 'decisionWindowMs')
    );
  }

  return true;
};

export const validateEscalationPolicy = (
  value: unknown,
  path: string,
  issues: string[],
  required: boolean,
): value is EscalationPolicy | DeepPartial<EscalationPolicy> => {
  if (value === undefined) {
    if (required) {
      issues.push(`${path} is required`);
    }

    return !required;
  }

  if (!isPlainObject(value)) {
    issues.push(`${path} must be an object`);
    return false;
  }

  if (!validateFullSet(value, ['allowedGrantScopes', 'maxGrantScope', 'denyByDefault', 'grantRules'], path, issues)) {
    return false;
  }

  if (
    hasOwn(value, 'allowedGrantScopes') &&
    !validateStringArray(value.allowedGrantScopes, `${path}.allowedGrantScopes`, issues)
  ) {
    return false;
  }

  if (hasOwn(value, 'allowedGrantScopes')) {
    const allowedGrantScopes = value.allowedGrantScopes as readonly string[];
    for (const [index, entry] of allowedGrantScopes.entries()) {
      if (!['per-command', 'per-command-prefix', 'per-host', 'session'].includes(entry)) {
        issues.push(`${path}.allowedGrantScopes[${index}] must be a valid scope`);
        return false;
      }
    }
  }

  if (
    hasOwn(value, 'maxGrantScope') &&
    !validateEnumValue(
      value.maxGrantScope,
      `${path}.maxGrantScope`,
      ['per-command', 'per-command-prefix', 'per-host', 'session'],
      issues,
    )
  ) {
    return false;
  }

  if (hasOwn(value, 'denyByDefault') && !validateBoolean(value.denyByDefault, `${path}.denyByDefault`, issues)) {
    return false;
  }

  if (hasOwn(value, 'grantRules')) {
    if (!Array.isArray(value.grantRules)) {
      issues.push(`${path}.grantRules must be an array`);
      return false;
    }

    for (const [index, entry] of value.grantRules.entries()) {
      if (!isPlainObject(entry)) {
        issues.push(`${path}.grantRules[${index}] must be an object`);
        return false;
      }

      if (
        !validateFullSet(
          entry,
          ['reason', 'scope', 'prefixes', 'requiresOperator'],
          `${path}.grantRules[${index}]`,
          issues,
        )
      ) {
        return false;
      }

      if (!hasOwn(entry, 'reason')) {
        issues.push(`${path}.grantRules[${index}].reason is required`);
        return false;
      }

      if (
        !validateEnumValue(
          entry.reason,
          `${path}.grantRules[${index}].reason`,
          ['dependency-install', 'verification', 'worker-tool', 'other'],
          issues,
        )
      ) {
        return false;
      }

      if (!hasOwn(entry, 'scope')) {
        issues.push(`${path}.grantRules[${index}].scope is required`);
        return false;
      }

      if (
        !validateEnumValue(
          entry.scope,
          `${path}.grantRules[${index}].scope`,
          ['per-command', 'per-command-prefix'],
          issues,
        )
      ) {
        return false;
      }

      if (
        hasOwn(entry, 'prefixes') &&
        !validateStringArray(entry.prefixes, `${path}.grantRules[${index}].prefixes`, issues)
      ) {
        return false;
      }

      if (
        hasOwn(entry, 'requiresOperator') &&
        !validateBoolean(entry.requiresOperator, `${path}.grantRules[${index}].requiresOperator`, issues)
      ) {
        return false;
      }
    }
  }

  if (required) {
    return (
      hasOwn(value, 'allowedGrantScopes') &&
      hasOwn(value, 'maxGrantScope') &&
      hasOwn(value, 'denyByDefault') &&
      hasOwn(value, 'grantRules')
    );
  }

  return true;
};

export const validateChangePolicy = (
  value: unknown,
  path: string,
  issues: string[],
  required: boolean,
): value is ChangePolicy | DeepPartial<ChangePolicy> => {
  if (value === undefined) {
    if (required) {
      issues.push(`${path} is required`);
    }

    return !required;
  }

  if (!isPlainObject(value)) {
    issues.push(`${path} must be an object`);
    return false;
  }

  if (!validateFullSet(value, ['allowedChangePaths'], path, issues)) {
    return false;
  }

  if (
    hasOwn(value, 'allowedChangePaths') &&
    !validateStringArray(value.allowedChangePaths, `${path}.allowedChangePaths`, issues)
  ) {
    return false;
  }

  return required ? hasOwn(value, 'allowedChangePaths') : true;
};

export const validateCapabilitySetting = (
  value: unknown,
  path: string,
  issues: string[],
  required: boolean,
): value is CapabilitySetting | DeepPartial<CapabilitySetting> => {
  if (value === undefined) {
    if (required) {
      issues.push(`${path} is required`);
    }

    return !required;
  }

  if (!isPlainObject(value)) {
    issues.push(`${path} must be an object`);
    return false;
  }

  if (!validateFullSet(value, ['desired', 'requireFreshAttestation'], path, issues)) {
    return false;
  }

  if (hasOwn(value, 'desired') && !validateBoolean(value.desired, `${path}.desired`, issues)) {
    return false;
  }

  if (hasOwn(value, 'requireFreshAttestation') && value.requireFreshAttestation !== true) {
    issues.push(`${path}.requireFreshAttestation must be true`);
    return false;
  }

  if (required) {
    return (
      hasOwn(value, 'desired') && hasOwn(value, 'requireFreshAttestation') && value.requireFreshAttestation === true
    );
  }

  return true;
};

export const validateCapabilityPolicy = (
  value: unknown,
  path: string,
  issues: string[],
  required: boolean,
): value is CapabilityPolicy | DeepPartial<CapabilityPolicy> => {
  if (value === undefined) {
    if (required) {
      issues.push(`${path} is required`);
    }

    return !required;
  }

  if (!isPlainObject(value)) {
    issues.push(`${path} must be an object`);
    return false;
  }

  if (
    !validateFullSet(value, ['auto-merge', 'auto-recover', 'unattended-run', 'escalation-auto-grant'], path, issues)
  ) {
    return false;
  }

  for (const key of ['auto-merge', 'auto-recover', 'unattended-run', 'escalation-auto-grant'] as const) {
    if (hasOwn(value, key) && !validateCapabilitySetting(value[key], `${path}.${key}`, issues, required)) {
      return false;
    }
  }

  if (required) {
    return ['auto-merge', 'auto-recover', 'unattended-run', 'escalation-auto-grant'].every(
      (key) => hasOwn(value, key) && (value[key] as CapabilitySetting).requireFreshAttestation === true,
    );
  }

  return true;
};

export const validateCredentialReferencePolicy = (
  value: unknown,
  path: string,
  issues: string[],
  required: boolean,
): value is CredentialReferencePolicy | DeepPartial<CredentialReferencePolicy> => {
  if (value === undefined) {
    if (required) {
      issues.push(`${path} is required`);
    }

    return !required;
  }

  if (!isPlainObject(value)) {
    issues.push(`${path} must be an object`);
    return false;
  }

  if (!validateFullSet(value, ['refs'], path, issues)) {
    return false;
  }

  if (hasOwn(value, 'refs')) {
    if (!Array.isArray(value.refs)) {
      issues.push(`${path}.refs must be an array`);
      return false;
    }

    for (const [index, entry] of value.refs.entries()) {
      if (!isPlainObject(entry)) {
        issues.push(`${path}.refs[${index}] must be an object`);
        return false;
      }

      if (
        !validateFullSet(
          entry,
          ['id', 'kind', 'purpose', 'secret', 'allowedParties', 'allowedPhases', 'allowedHosts', 'ttlSeconds'],
          `${path}.refs[${index}]`,
          issues,
        )
      ) {
        return false;
      }

      if (!hasOwn(entry, 'id')) {
        issues.push(`${path}.refs[${index}].id is required`);
        return false;
      }

      if (typeof entry.id !== 'string') {
        issues.push(`${path}.refs[${index}].id must be a string`);
        return false;
      }

      if (!hasOwn(entry, 'kind')) {
        issues.push(`${path}.refs[${index}].kind is required`);
        return false;
      }

      if (
        !validateEnumValue(
          entry.kind,
          `${path}.refs[${index}].kind`,
          ['forge', 'registry-read', 'registry-publish', 'tool-api', 'verification'],
          issues,
        )
      ) {
        return false;
      }

      if (!hasOwn(entry, 'purpose')) {
        issues.push(`${path}.refs[${index}].purpose is required`);
        return false;
      }

      if (typeof entry.purpose !== 'string') {
        issues.push(`${path}.refs[${index}].purpose must be a string`);
        return false;
      }

      if (!hasOwn(entry, 'secret')) {
        issues.push(`${path}.refs[${index}].secret is required`);
        return false;
      }

      if (!isPlainObject(entry.secret)) {
        issues.push(`${path}.refs[${index}].secret must be an object`);
        return false;
      }

      if (!validateFullSet(entry.secret, ['source', 'key', 'version'], `${path}.refs[${index}].secret`, issues)) {
        return false;
      }

      if (!hasOwn(entry.secret, 'source')) {
        issues.push(`${path}.refs[${index}].secret.source is required`);
        return false;
      }

      if (
        !validateEnumValue(
          entry.secret.source,
          `${path}.refs[${index}].secret.source`,
          ['env', 'secret-manager'],
          issues,
        )
      ) {
        return false;
      }

      if (!hasOwn(entry.secret, 'key')) {
        issues.push(`${path}.refs[${index}].secret.key is required`);
        return false;
      }

      if (typeof entry.secret.key !== 'string') {
        issues.push(`${path}.refs[${index}].secret.key must be a string`);
        return false;
      }

      if (hasOwn(entry.secret, 'version') && typeof entry.secret.version !== 'string') {
        issues.push(`${path}.refs[${index}].secret.version must be a string`);
        return false;
      }

      if (!hasOwn(entry, 'allowedParties')) {
        issues.push(`${path}.refs[${index}].allowedParties is required`);
        return false;
      }

      if (!Array.isArray(entry.allowedParties)) {
        issues.push(`${path}.refs[${index}].allowedParties must be an array`);
        return false;
      }

      for (const [partyIndex, party] of entry.allowedParties.entries()) {
        if (!['runner', 'worker'].includes(party)) {
          issues.push(`${path}.refs[${index}].allowedParties[${partyIndex}] must be runner or worker`);
          return false;
        }
      }

      if (!hasOwn(entry, 'allowedPhases')) {
        issues.push(`${path}.refs[${index}].allowedPhases is required`);
        return false;
      }

      if (!validateStringArray(entry.allowedPhases, `${path}.refs[${index}].allowedPhases`, issues)) {
        return false;
      }

      if (!hasOwn(entry, 'allowedHosts')) {
        issues.push(`${path}.refs[${index}].allowedHosts is required`);
        return false;
      }

      if (!validateStringArray(entry.allowedHosts, `${path}.refs[${index}].allowedHosts`, issues)) {
        return false;
      }

      if (!hasOwn(entry, 'ttlSeconds')) {
        issues.push(`${path}.refs[${index}].ttlSeconds is required`);
        return false;
      }

      if (
        !validateNumber(entry.ttlSeconds, `${path}.refs[${index}].ttlSeconds`, issues) ||
        !Number.isInteger(entry.ttlSeconds) ||
        entry.ttlSeconds <= 0
      ) {
        issues.push(`${path}.refs[${index}].ttlSeconds must be a positive integer`);
        return false;
      }
    }
  }

  return required ? hasOwn(value, 'refs') : true;
};
