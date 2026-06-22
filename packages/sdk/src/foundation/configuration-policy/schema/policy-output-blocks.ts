import type { DeepPartial, EgressPolicySource, MergePolicy } from './types.js';
import {
  hasOwn,
  isFiniteNumber,
  isPlainObject,
  validateBoolean,
  validateEnumValue,
  validateFullSet,
  validateStringArray,
} from './validation-primitives.js';

export const validateEgressPolicySource = (
  value: unknown,
  path: string,
  issues: string[],
  required: boolean,
): value is EgressPolicySource | DeepPartial<EgressPolicySource> => {
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

  if (!validateFullSet(value, ['defaultAction', 'rules', 'negativeProbes', 'requiredAttesters'], path, issues)) {
    return false;
  }

  if (hasOwn(value, 'defaultAction') && value.defaultAction !== 'deny') {
    issues.push(`${path}.defaultAction must be deny`);
    return false;
  }

  if (hasOwn(value, 'rules')) {
    if (!Array.isArray(value.rules)) {
      issues.push(`${path}.rules must be an array`);
      return false;
    }

    for (const [index, entry] of value.rules.entries()) {
      if (!isPlainObject(entry)) {
        issues.push(`${path}.rules[${index}] must be an object`);
        return false;
      }

      if (
        !validateFullSet(
          entry,
          ['credentialRefIds', 'protocols', 'hosts', 'ports', 'phase', 'purpose'],
          `${path}.rules[${index}]`,
          issues,
        )
      ) {
        return false;
      }

      if (!hasOwn(entry, 'credentialRefIds')) {
        issues.push(`${path}.rules[${index}].credentialRefIds is required`);
        return false;
      }

      if (!validateStringArray(entry.credentialRefIds, `${path}.rules[${index}].credentialRefIds`, issues)) {
        return false;
      }

      if (!hasOwn(entry, 'protocols')) {
        issues.push(`${path}.rules[${index}].protocols is required`);
        return false;
      }

      if (!Array.isArray(entry.protocols)) {
        issues.push(`${path}.rules[${index}].protocols must be an array`);
        return false;
      }

      for (const [protocolIndex, protocol] of entry.protocols.entries()) {
        if (!['https', 'ssh'].includes(protocol)) {
          issues.push(`${path}.rules[${index}].protocols[${protocolIndex}] must be https or ssh`);
          return false;
        }
      }

      if (!hasOwn(entry, 'hosts')) {
        issues.push(`${path}.rules[${index}].hosts is required`);
        return false;
      }

      if (!validateStringArray(entry.hosts, `${path}.rules[${index}].hosts`, issues)) {
        return false;
      }

      if (hasOwn(entry, 'ports')) {
        if (!Array.isArray(entry.ports)) {
          issues.push(`${path}.rules[${index}].ports must be an array`);
          return false;
        }

        for (const [portIndex, port] of entry.ports.entries()) {
          if (!isFiniteNumber(port) || !Number.isInteger(port) || port < 0) {
            issues.push(`${path}.rules[${index}].ports[${portIndex}] must be a non-negative integer`);
            return false;
          }
        }
      }

      if (!hasOwn(entry, 'phase')) {
        issues.push(`${path}.rules[${index}].phase is required`);
        return false;
      }

      if (typeof entry.phase !== 'string') {
        issues.push(`${path}.rules[${index}].phase must be a string`);
        return false;
      }

      if (!hasOwn(entry, 'purpose')) {
        issues.push(`${path}.rules[${index}].purpose is required`);
        return false;
      }

      if (typeof entry.purpose !== 'string') {
        issues.push(`${path}.rules[${index}].purpose must be a string`);
        return false;
      }
    }
  }

  if (hasOwn(value, 'negativeProbes')) {
    if (!Array.isArray(value.negativeProbes)) {
      issues.push(`${path}.negativeProbes must be an array`);
      return false;
    }

    for (const [index, entry] of value.negativeProbes.entries()) {
      if (!isPlainObject(entry)) {
        issues.push(`${path}.negativeProbes[${index}] must be an object`);
        return false;
      }

      if (
        !validateFullSet(entry, ['host', 'protocol', 'expected', 'reason'], `${path}.negativeProbes[${index}]`, issues)
      ) {
        return false;
      }

      if (!hasOwn(entry, 'host')) {
        issues.push(`${path}.negativeProbes[${index}].host is required`);
        return false;
      }

      if (typeof entry.host !== 'string') {
        issues.push(`${path}.negativeProbes[${index}].host must be a string`);
        return false;
      }

      if (!hasOwn(entry, 'protocol')) {
        issues.push(`${path}.negativeProbes[${index}].protocol is required`);
        return false;
      }

      if (!validateEnumValue(entry.protocol, `${path}.negativeProbes[${index}].protocol`, ['https', 'ssh'], issues)) {
        return false;
      }

      if (!hasOwn(entry, 'expected')) {
        issues.push(`${path}.negativeProbes[${index}].expected is required`);
        return false;
      }

      if (entry.expected !== 'blocked') {
        issues.push(`${path}.negativeProbes[${index}].expected must be blocked`);
        return false;
      }

      if (!hasOwn(entry, 'reason')) {
        issues.push(`${path}.negativeProbes[${index}].reason is required`);
        return false;
      }

      if (typeof entry.reason !== 'string') {
        issues.push(`${path}.negativeProbes[${index}].reason must be a string`);
        return false;
      }
    }
  }

  if (hasOwn(value, 'requiredAttesters')) {
    if (!Array.isArray(value.requiredAttesters)) {
      issues.push(`${path}.requiredAttesters must be an array`);
      return false;
    }

    for (const [index, entry] of value.requiredAttesters.entries()) {
      if (!isPlainObject(entry)) {
        issues.push(`${path}.requiredAttesters[${index}] must be an object`);
        return false;
      }

      if (!validateFullSet(entry, ['point', 'capability', 'driverId'], `${path}.requiredAttesters[${index}]`, issues)) {
        return false;
      }

      if (!hasOwn(entry, 'point')) {
        issues.push(`${path}.requiredAttesters[${index}].point is required`);
        return false;
      }

      if (entry.point !== 'execution-host') {
        issues.push(`${path}.requiredAttesters[${index}].point must be execution-host`);
        return false;
      }

      if (!hasOwn(entry, 'capability')) {
        issues.push(`${path}.requiredAttesters[${index}].capability is required`);
        return false;
      }

      if (entry.capability !== 'egress-confinement') {
        issues.push(`${path}.requiredAttesters[${index}].capability must be egress-confinement`);
        return false;
      }

      if (!hasOwn(entry, 'driverId')) {
        issues.push(`${path}.requiredAttesters[${index}].driverId is required`);
        return false;
      }

      if (typeof entry.driverId !== 'string') {
        issues.push(`${path}.requiredAttesters[${index}].driverId must be a string`);
        return false;
      }
    }
  }

  return required
    ? hasOwn(value, 'defaultAction') &&
        hasOwn(value, 'rules') &&
        hasOwn(value, 'negativeProbes') &&
        hasOwn(value, 'requiredAttesters')
    : true;
};

export const validateMergePolicy = (
  value: unknown,
  path: string,
  issues: string[],
  required: boolean,
): value is MergePolicy | DeepPartial<MergePolicy> => {
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
      ['runnerMayPush', 'runnerMayOpenPr', 'runnerMayMerge', 'requiredEvidence', 'mergeMethod'],
      path,
      issues,
    )
  ) {
    return false;
  }

  if (hasOwn(value, 'runnerMayPush') && !validateBoolean(value.runnerMayPush, `${path}.runnerMayPush`, issues)) {
    return false;
  }

  if (hasOwn(value, 'runnerMayOpenPr') && !validateBoolean(value.runnerMayOpenPr, `${path}.runnerMayOpenPr`, issues)) {
    return false;
  }

  if (hasOwn(value, 'runnerMayMerge') && !validateBoolean(value.runnerMayMerge, `${path}.runnerMayMerge`, issues)) {
    return false;
  }

  if (
    hasOwn(value, 'requiredEvidence') &&
    !validateStringArray(value.requiredEvidence, `${path}.requiredEvidence`, issues)
  ) {
    return false;
  }

  if (hasOwn(value, 'requiredEvidence')) {
    const requiredEvidence = value.requiredEvidence as readonly string[];
    for (const [index, entry] of requiredEvidence.entries()) {
      if (!['verification', 'ci', 'review', 'threads-resolved', 'protection'].includes(entry)) {
        issues.push(`${path}.requiredEvidence[${index}] must be a valid evidence token`);
        return false;
      }
    }
  }

  if (
    hasOwn(value, 'mergeMethod') &&
    !validateEnumValue(value.mergeMethod, `${path}.mergeMethod`, ['merge', 'squash', 'rebase'], issues)
  ) {
    return false;
  }

  return required
    ? hasOwn(value, 'runnerMayPush') &&
        hasOwn(value, 'runnerMayOpenPr') &&
        hasOwn(value, 'runnerMayMerge') &&
        hasOwn(value, 'requiredEvidence')
    : true;
};
