import {
  configurationSchemaMarker,
  type KitConfig,
  type PolicyLayer,
  type PolicyLayerPatch,
  type Result,
  type RunConfigInput,
  type ValidationFailure,
} from './types.js';
import {
  configInvalid,
  fail,
  hasOwn,
  isFiniteNumber,
  isPlainObject,
  findDeferredCapabilityPath,
  ok,
  rejectDeferredCapability,
  validateBoolean,
  validateEnumValue,
  validateFullSet,
  validateNumber,
  validatePartialSet,
  validateStringArray,
  unsupportedDeferredCapability,
} from './validation-primitives.js';
import {
  validateApprovalPolicy,
  validateCapabilityPolicy,
  validateCapabilitySetting,
  validateChangePolicy,
  validateCredentialReferencePolicy,
  validateEscalationPolicy,
  validateProvisioningPolicy,
  validateRunPolicy,
} from './policy-core-blocks.js';
import { validateEgressPolicySource, validateMergePolicy } from './policy-output-blocks.js';

export {
  configInvalid,
  fail,
  hasOwn,
  isFiniteNumber,
  isPlainObject,
  findDeferredCapabilityPath,
  ok,
  rejectDeferredCapability,
  validateBoolean,
  validateEnumValue,
  validateFullSet,
  validateNumber,
  validatePartialSet,
  validateStringArray,
  unsupportedDeferredCapability,
  validateApprovalPolicy,
  validateCapabilityPolicy,
  validateCapabilitySetting,
  validateChangePolicy,
  validateCredentialReferencePolicy,
  validateEscalationPolicy,
  validateProvisioningPolicy,
  validateRunPolicy,
  validateEgressPolicySource,
  validateMergePolicy,
};

export const validatePolicyLayerShape = (
  value: unknown,
  path: string,
  issues: string[],
  required: boolean,
): value is PolicyLayer | PolicyLayerPatch => {
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
    !validateFullSet(
      value,
      [
        'run',
        'provisioning',
        'approval',
        'escalationPolicy',
        'changePolicy',
        'capabilities',
        'credentialRefs',
        'egress',
        'merge',
      ],
      path,
      issues,
    )
  ) {
    return false;
  }

  if (!validateRunPolicy(value.run, `${path}.run`, issues, required)) {
    return false;
  }

  if (!validateProvisioningPolicy(value.provisioning, `${path}.provisioning`, issues, required)) {
    return false;
  }

  if (!validateApprovalPolicy(value.approval, `${path}.approval`, issues, required)) {
    return false;
  }

  if (!validateEscalationPolicy(value.escalationPolicy, `${path}.escalationPolicy`, issues, required)) {
    return false;
  }

  if (!validateChangePolicy(value.changePolicy, `${path}.changePolicy`, issues, required)) {
    return false;
  }

  if (!validateCapabilityPolicy(value.capabilities, `${path}.capabilities`, issues, required)) {
    return false;
  }

  if (!validateCredentialReferencePolicy(value.credentialRefs, `${path}.credentialRefs`, issues, required)) {
    return false;
  }

  if (!validateEgressPolicySource(value.egress, `${path}.egress`, issues, required)) {
    return false;
  }

  if (!validateMergePolicy(value.merge, `${path}.merge`, issues, required)) {
    return false;
  }

  return true;
};

export const validatePolicyLayer = (value: unknown): Result<PolicyLayer, ValidationFailure> => {
  const issues: string[] = [];
  const deferred = rejectDeferredCapability(value, issues);
  if (deferred) {
    return fail(deferred);
  }

  if (!validatePolicyLayerShape(value, '$', issues, true)) {
    return fail(configInvalid(issues));
  }

  return ok(value as PolicyLayer);
};

export const validatePolicyLayerPatch = (value: unknown): Result<PolicyLayerPatch, ValidationFailure> => {
  const issues: string[] = [];
  const deferred = rejectDeferredCapability(value, issues);
  if (deferred) {
    return fail(deferred);
  }

  if (!validatePolicyLayerShape(value, '$', issues, false)) {
    return fail(configInvalid(issues));
  }

  return ok(value as PolicyLayerPatch);
};

export const validateRunConfigInput = (value: unknown): Result<RunConfigInput, ValidationFailure> => {
  const issues: string[] = [];
  const deferred = rejectDeferredCapability(value, issues);
  if (deferred) {
    return fail(deferred);
  }

  if (value === undefined) {
    return ok({} as RunConfigInput);
  }

  if (!isPlainObject(value)) {
    return fail(configInvalid(['run config input must be an object']));
  }

  if (!validateFullSet(value, ['profile', 'overrides', 'run'], '$', issues)) {
    return fail(configInvalid(issues));
  }

  if (hasOwn(value, 'profile') && typeof value.profile !== 'string') {
    issues.push('$.profile must be a string');
  }

  if (hasOwn(value, 'overrides')) {
    const result = validatePolicyLayerPatch(value.overrides);
    if (!result.ok) {
      return fail(result.error);
    }
  }

  if (hasOwn(value, 'run')) {
    const run = value.run;
    if (!isPlainObject(run)) {
      issues.push('$.run must be an object');
    } else {
      if (!validateFullSet(run, ['taskId', 'trackId', 'dryRun'], '$.run', issues)) {
        return fail(configInvalid(issues));
      }

      if (hasOwn(run, 'taskId') && typeof run.taskId !== 'string') {
        issues.push('$.run.taskId must be a string');
      }

      if (hasOwn(run, 'trackId') && typeof run.trackId !== 'string') {
        issues.push('$.run.trackId must be a string');
      }

      if (hasOwn(run, 'dryRun') && typeof run.dryRun !== 'boolean') {
        issues.push('$.run.dryRun must be a boolean');
      }
    }
  }

  if (issues.length > 0) {
    return fail(configInvalid(issues));
  }

  return ok(value as RunConfigInput);
};

export const validateKitConfig = (value: unknown): Result<KitConfig, ValidationFailure> => {
  const issues: string[] = [];
  const deferred = rejectDeferredCapability(value, issues);
  if (deferred) {
    return fail(deferred);
  }

  if (!isPlainObject(value)) {
    return fail(configInvalid(['kit config must be an object']));
  }

  if (!validateFullSet(value, ['schema', 'project', 'profiles'], '$', issues)) {
    return fail(configInvalid(issues));
  }

  if (value.schema !== configurationSchemaMarker) {
    issues.push('$.schema must be kit-vnext.config.v1');
    return fail(configInvalid(issues));
  }

  if (!isPlainObject(value.project)) {
    issues.push('$.project must be an object');
    return fail(configInvalid(issues));
  }

  if (!validateFullSet(value.project, ['id', 'rootPolicy', 'tracks'], '$.project', issues)) {
    return fail(configInvalid(issues));
  }

  if (typeof value.project.id !== 'string') {
    issues.push('$.project.id must be a string');
  }

  if (value.project.rootPolicy !== 'single-repo') {
    issues.push('$.project.rootPolicy must be single-repo');
  }

  if (hasOwn(value.project, 'tracks') && !validateStringArray(value.project.tracks, '$.project.tracks', issues)) {
    return fail(configInvalid(issues));
  }

  if (hasOwn(value, 'profiles')) {
    if (!isPlainObject(value.profiles)) {
      issues.push('$.profiles must be a record of profile patches');
      return fail(configInvalid(issues));
    }

    for (const profilePatch of Object.values(value.profiles)) {
      const profileResult = validatePolicyLayerPatch(profilePatch);
      if (!profileResult.ok) {
        return fail(profileResult.error);
      }
    }
  }

  if (issues.length > 0) {
    return fail(configInvalid(issues));
  }

  return ok(value as KitConfig);
};
