import { deferredCapabilityName, type Result, type ValidationFailure } from './types.js';

export const configInvalid = (issues: readonly string[]): ValidationFailure => ({
  token: 'config-invalid',
  issues,
});

export const unsupportedDeferredCapability = (issues: readonly string[]): ValidationFailure => ({
  token: 'unsupported-deferred-capability',
  issues,
});

export const ok = <T>(value: T): Result<T, ValidationFailure> => ({
  ok: true,
  value,
});

export const fail = (error: ValidationFailure): Result<never, ValidationFailure> => ({
  ok: false,
  error,
});

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

export const hasOwn = (value: Record<string, unknown>, key: string): boolean => Object.hasOwn(value, key);

export const validateStringArray = (value: unknown, path: string, issues: string[]): value is readonly string[] => {
  if (!Array.isArray(value)) {
    issues.push(`${path} must be an array of strings`);
    return false;
  }

  for (const [index, entry] of value.entries()) {
    if (typeof entry !== 'string') {
      issues.push(`${path}[${index}] must be a string`);
      return false;
    }
  }

  return true;
};

export const validateEnumValue = <T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
  issues: string[],
): value is T => {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    issues.push(`${path} must be one of: ${allowed.join(', ')}`);
    return false;
  }

  return true;
};

export const validateBoolean = (value: unknown, path: string, issues: string[]): value is boolean => {
  if (typeof value !== 'boolean') {
    issues.push(`${path} must be a boolean`);
    return false;
  }

  return true;
};

export const validateNumber = (value: unknown, path: string, issues: string[]): value is number => {
  if (!isFiniteNumber(value)) {
    issues.push(`${path} must be a finite number`);
    return false;
  }

  return true;
};

export const validateFullSet = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
  issues: string[],
): boolean => {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(value).filter((key) => !allowed.has(key));

  if (unknownKeys.length > 0) {
    issues.push(`${path} contains unknown fields: ${unknownKeys.sort().join(', ')}`);
    return false;
  }

  return true;
};

export const validatePartialSet = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string,
  issues: string[],
): boolean => validateFullSet(value, allowedKeys, path, issues);

const DEFERRED_CAPABILITY_VALUE_KEYS = new Set(['mode']);

export const findDeferredCapabilityPath = (value: unknown, path = '$', fieldName?: string): string | null => {
  if (value === deferredCapabilityName && fieldName !== undefined && DEFERRED_CAPABILITY_VALUE_KEYS.has(fieldName)) {
    return path;
  }

  if (Array.isArray(value)) {
    for (const [index, entry] of value.entries()) {
      const match = findDeferredCapabilityPath(entry, `${path}[${index}]`);
      if (match) {
        return match;
      }
    }

    return null;
  }

  if (!isPlainObject(value)) {
    return null;
  }

  for (const [key, entry] of Object.entries(value)) {
    const match = findDeferredCapabilityPath(entry, `${path}.${key}`, key);
    if (match) {
      return match;
    }
  }

  return null;
};

export const rejectDeferredCapability = (value: unknown, issues: string[]): ValidationFailure | null => {
  const match = findDeferredCapabilityPath(value);
  if (!match) {
    return null;
  }

  issues.push(`deferred capability is not supported at ${match}`);
  return unsupportedDeferredCapability(issues);
};
