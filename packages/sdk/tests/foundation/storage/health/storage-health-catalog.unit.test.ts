import { describe, expect, it } from 'vitest';
import {
  STORAGE_ERROR_CODES,
  type StorageError,
  STORAGE_HEALTH_STATES,
  type StorageHealth,
} from '../../../../src/index.js';

const assertNever = (value: never): never => {
  throw new Error(`Unhandled value: ${String(value)}`);
};

const describeHealth = (health: StorageHealth): string => {
  switch (health) {
    case 'ok':
      return 'healthy';
    case 'log-tail-repaired':
      return 'tail repaired';
    case 'log-interior-corrupt':
      return 'interior corrupt';
    case 'network-fs-degraded':
      return 'network fs degraded';
    case 'read-only':
      return 'read only';
    case 'unusable':
      return 'unusable';
    default:
      return assertNever(health);
  }
};

describe('fnd-02-s1 storage health catalog', () => {
  it('defines the full StorageHealth state set with exhaustive coverage', () => {
    expect(STORAGE_HEALTH_STATES.map(describeHealth)).toEqual([
      'healthy',
      'tail repaired',
      'interior corrupt',
      'network fs degraded',
      'read only',
      'unusable',
    ]);
  });

  it('defines the exact StorageErrorCode token catalog', () => {
    expect(STORAGE_ERROR_CODES).toEqual([
      'stale-writer-fenced',
      'lease-unavailable',
      'log-tail-repaired',
      'log-interior-corrupt',
      'artifact-quarantined',
      'export-incomplete-forbidden',
      'network-fs-degraded',
    ]);
  });

  it('exposes frozen runtime catalogs that cannot be mutated', () => {
    expect(Object.isFrozen(STORAGE_HEALTH_STATES)).toBe(true);
    expect(Object.isFrozen(STORAGE_ERROR_CODES)).toBe(true);

    expect(() => {
      (STORAGE_HEALTH_STATES as unknown as string[])[0] = 'broken-health';
    }).toThrow(TypeError);
    expect(() => {
      (STORAGE_ERROR_CODES as unknown as string[])[0] = 'broken-error';
    }).toThrow(TypeError);

    expect(STORAGE_HEALTH_STATES).toEqual([
      'ok',
      'log-tail-repaired',
      'log-interior-corrupt',
      'network-fs-degraded',
      'read-only',
      'unusable',
    ]);
    expect(STORAGE_ERROR_CODES).toEqual([
      'stale-writer-fenced',
      'lease-unavailable',
      'log-tail-repaired',
      'log-interior-corrupt',
      'artifact-quarantined',
      'export-incomplete-forbidden',
      'network-fs-degraded',
    ]);
  });

  it('keeps StorageError health-aware without promoting read-only or unusable to error codes', () => {
    const storageError: StorageError = {
      code: 'network-fs-degraded',
      message: 'Authoritative export is unavailable while storage guarantees are degraded.',
      health: 'network-fs-degraded',
    };

    expect(storageError).toEqual({
      code: 'network-fs-degraded',
      message: 'Authoritative export is unavailable while storage guarantees are degraded.',
      health: 'network-fs-degraded',
    });
    expect(STORAGE_ERROR_CODES).not.toContain('read-only');
    expect(STORAGE_ERROR_CODES).not.toContain('unusable');
  });
});
